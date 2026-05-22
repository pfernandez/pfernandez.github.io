import { parse } from '../../graph/parse.js'
import { observe } from './observe.js'
import { createWasmCore } from './wasm.js'

const fixedRoot = () => {
  const I = []
  I[0] = I
  I[1] = I

  return I
}

export const createJsRuntime = () => {
  const I = fixedRoot()

  return {
    I,
    equal: Object.is,
    frame: (observer, focus) => [observer, focus],
    left: pair => pair[0],
    observe,
    pair: (first = I, next = I) => [first, next],
    right: pair => pair[1],
    setLeft: (pair, value) => {
      pair[0] = value
      return pair
    },
    setRight: (pair, value) => {
      pair[1] = value
      return pair
    },
  }
}

export const createWasmRuntime = async () => {
  const core = await createWasmCore()

  return {
    I: core.I,
    equal: Object.is,
    frame: core.pair,
    left: core.left,
    observe: core.observe,
    pair: (first = core.I, next = core.I) => core.pair(first, next),
    right: core.right,
    setLeft: core.setLeft,
    setRight: core.setRight,
    size: core.size,
  }
}

const isPair = Array.isArray

const applyArgs = (head, args) =>
  args.reduce((left, right) => [left, right], head)

const ast = term => {
  if (!isPair(term)) return String(term)
  if (!term.length) return []

  return applyArgs(ast(term[0]), term.slice(1).map(ast))
}

const applicationOf = term => {
  if (!isPair(term) || !term.length) return { args: [], head: term }

  const prefix = applicationOf(term[0])
  return { args: [...prefix.args, term[1]], head: prefix.head }
}

const resolveTerm = (term, env, seen = []) => {
  if (typeof term === 'string' && env.has(term)) {
    if (seen.includes(term)) {
      throw new Error(`cyclic alias: ${[...seen, term].join(' -> ')}`)
    }

    return resolveTerm(env.get(term), env, [...seen, term])
  }

  if (!isPair(term) || !term.length) return term

  return [
    resolveTerm(term[0], env, seen),
    resolveTerm(term[1], env, seen),
  ]
}

const createSymbols = runtime => {
  const symbols = new Map()

  const createPattern = depth => {
    let pattern = runtime.I
    for (let i = 0; i <= depth; i += 1) {
      pattern = runtime.pair(runtime.I, pattern)
    }

    return pattern
  }

  const symbol = name => {
    if (!symbols.has(name)) {
      symbols.set(name, createPattern(symbols.size))
    }

    return symbols.get(name)
  }

  return { symbol, symbols }
}

const sameShape = (runtime, left, right) => {
  if (runtime.equal(left, runtime.I) || runtime.equal(right, runtime.I)) {
    return runtime.equal(left, right)
  }

  return sameShape(runtime, runtime.left(left), runtime.left(right))
    && sameShape(runtime, runtime.right(left), runtime.right(right))
}

const createSerializer = (runtime, symbols) => {
  const knownSymbol = graph => {
    for (const [name, pattern] of symbols) {
      if (sameShape(runtime, graph, pattern)) return name
    }
  }

  const print = (graph, path = '$', seen = new Map()) => {
    if (runtime.equal(graph, runtime.I)) return '()'

    const name = knownSymbol(graph)
    if (name) return name

    if (seen.has(graph)) return seen.get(graph)
    seen.set(graph, path)

    return [
      '(',
      print(runtime.left(graph), `${path}[0]`, seen),
      ' ',
      print(runtime.right(graph), `${path}[1]`, seen),
      ')',
    ].join('')
  }

  return print
}

export const createRepl = (runtime = createJsRuntime()) => {
  const aliases = new Map()
  const closures = new Map()
  const definitions = new Map()
  const { symbol, symbols } = createSymbols(runtime)
  const serialize = createSerializer(runtime, symbols)

  const buildArgumentList = args =>
    args.length ? applyArgs(args[0], args.slice(1)) : runtime.I

  const closureValue = closure =>
    runtime.pair(buildArgumentList(closure.values), runtime.I)

  const applyDefinition = (definition, prefixValues, argTerms, bindings) => {
    const argValues = argTerms.map(arg => compileNode(arg, bindings).value)
    const values = [...prefixValues, ...argValues]

    if (values.length < definition.params.length) {
      const closure = { definition, values }
      return { closure, value: closureValue(closure) }
    }

    const used = values.slice(0, definition.params.length)
    const rest = values.slice(definition.params.length)
    const nextBindings = new Map(bindings)
    definition.params.forEach((name, index) => nextBindings.set(name, used[index]))

    const body = compileNode(definition.body, nextBindings).value
    const value = rest.reduce(
      (left, right) => runtime.pair(left, right),
      body
    )

    return {
      application: buildArgumentList(values),
      value,
    }
  }

  const compileNode = (term, bindings = new Map()) => {
    if (typeof term === 'string') {
      if (bindings.has(term)) return { value: bindings.get(term) }
      if (closures.has(term)) {
        const closure = closures.get(term)
        return { closure, value: closureValue(closure) }
      }

      const resolved = resolveTerm(term, aliases)
      if (resolved !== term) return compileNode(resolved, bindings)

      return { value: symbol(term) }
    }

    if (!isPair(term) || !term.length) return { value: runtime.I }

    const { args, head } = applicationOf(term)
    const resolvedHead = typeof head === 'string'
      ? resolveTerm(head, aliases)
      : head

    if (typeof resolvedHead === 'string' && definitions.has(resolvedHead)) {
      return applyDefinition(definitions.get(resolvedHead), [], args, bindings)
    }

    if (typeof resolvedHead === 'string' && closures.has(resolvedHead)) {
      const closure = closures.get(resolvedHead)
      return applyDefinition(closure.definition, closure.values, args, bindings)
    }

    if (resolvedHead !== head) {
      return compileNode(applyArgs(resolvedHead, args), bindings)
    }

    const left = compileNode(term[0], bindings).value
    const right = compileNode(term[1], bindings).value

    return { value: runtime.pair(left, right) }
  }

  const compileResult = (sourceAst, compiled) => {
    if (compiled.application) {
      const graph = runtime.pair()
      runtime.setLeft(graph, runtime.pair(graph, compiled.value))
      runtime.setRight(graph, compiled.application)
      const frame = runtime.frame(graph, graph)
      const result = runtime.observe(frame)

      return {
        ast: sourceAst,
        frame,
        graph,
        result,
        runtime,
        text: serialize(result),
      }
    }

    const graph = runtime.pair(runtime.I, compiled.value)
    const frame = runtime.frame(runtime.I, graph)
    const result = runtime.observe(frame)

    return {
      ast: sourceAst,
      frame,
      graph,
      result,
      runtime,
      text: serialize(result),
    }
  }

  const compileAst = sourceAst => {
    const form = resolveTerm(sourceAst, aliases)
    return compileResult(form, compileNode(form))
  }

  const compileForm = form => {
    if (isPair(form) && form[0] === 'def') {
      const name = String(form[1])
      const sourceAst = ast(form[2])
      const compiled = compileNode(sourceAst)

      aliases.delete(name)
      closures.delete(name)
      if (compiled.closure) {
        closures.set(name, compiled.closure)
      } else {
        aliases.set(name, sourceAst)
      }

      return { text: String(form[1]) }
    }

    if (isPair(form) && form[0] === 'defn') {
      const name = String(form[1])
      aliases.delete(name)
      closures.delete(name)
      definitions.set(name, {
        body: ast(form[3]),
        params: form[2].map(String),
      })

      return { text: name }
    }

    return compileAst(ast(form))
  }

  const compile = source => {
    const forms = parse(source)
    return forms.reduce((last, form) => compileForm(form), { text: '()' })
  }

  return {
    compile,
    closures,
    definitions,
    env: aliases,
    evaluate: compile,
    runtime,
    serialize,
    symbol,
  }
}

export const compile = (source, runtime = createJsRuntime()) =>
  createRepl(runtime).compile(source)

export const evaluate = compile
