import { parse as read } from '../../graph/parse.js'
import { observe as observeFrame } from './observe.js'
import { createWasmCore } from './wasm.js'

/**
 * @typedef {Array} Pair
 * @typedef {string | number | SourceForm[]} SourceForm
 * @typedef {string | Pair} SourceAst
 * @typedef {Pair | number} Graph
 *
 * @typedef {object} Definition
 * @property {SourceAst} body
 * @property {string[]} params
 *
 * @typedef {object} Closure
 * @property {Definition} definition
 * @property {Graph[]} values
 *
 * @typedef {object} PassiveRuntime
 * @property {Graph} I
 * @property {(left: Graph, right: Graph) => Graph} frame
 * @property {(pair: Graph) => Graph} left
 * @property {(frame: Graph) => Graph} observe
 * @property {(first?: Graph, next?: Graph) => Graph} pair
 * @property {(pair: Graph) => Graph} right
 * @property {(pair: Graph, value: Graph) => Graph} setLeft
 * @property {(pair: Graph, value: Graph) => Graph} setRight
 * @property {() => number} [size]
 *
 * @typedef {object} CompilerState
 * @property {Map<string, SourceAst>} aliases
 * @property {Map<string, Closure>} closures
 * @property {Map<string, Definition>} definitions
 * @property {PassiveRuntime} runtime
 * @property {Map<string, Graph>} symbols
 */

const fixedRoot = () => {
  const I = []
  I[0] = I
  I[1] = I

  return I
}

/**
 * Creates the array-backed runtime used by the tests and exploratory compiler.
 *
 * Each pair is a two-slot JavaScript array. The runtime supplies the same
 * surface as the WebAssembly runtime so the compiler can target either memory
 * model without changing its graph construction rules.
 *
 * @returns {PassiveRuntime}
 */
export const createJsRuntime = () => {
  const I = fixedRoot()

  return {
    I,
    equal: Object.is,
    frame: (observer, focus) => [observer, focus],
    left: pair => pair[0],
    observe: observeFrame,
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

/**
 * Creates a WebAssembly-backed passive runtime.
 *
 * The returned runtime stores pairs as two `i32` slots in linear memory. It has
 * the same operations as `createJsRuntime`, but graph values are numeric
 * pointers instead of JavaScript arrays.
 *
 * @returns {Promise<PassiveRuntime>}
 */
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

/**
 * Creates an empty compiler state for a runtime.
 *
 * The state carries source-side tables: aliases, function definitions, partial
 * closures, and symbol patterns. Compiler functions return a new state when
 * those tables change instead of mutating a hidden module-level compiler.
 *
 * @param {PassiveRuntime} [runtime]
 * @returns {CompilerState}
 */
export const init = (runtime = createJsRuntime()) => ({
  aliases: new Map(),
  closures: new Map(),
  definitions: new Map(),
  runtime,
  symbols: new Map(),
})

/**
 * Parses Lisp source into literal top-level source forms.
 *
 * This is a thin wrapper around the page parser so the passive Lisp pipeline is
 * readable at the call site:
 * `parse(source) -> compile(state, forms) -> observe(state, graph)`.
 *
 * @param {string} source
 * @returns {SourceForm[]}
 */
export const parse = source => read(source)

/**
 * Performs one passive observation step on a graph frame.
 *
 * The frame carries its observer in the left slot and its focus in the right
 * slot. Observation walks the focus without allocating or mutating and returns
 * the first selected future.
 *
 * @param {CompilerState} state
 * @param {Graph} graph
 * @returns {Graph}
 */
export const observe = (state, graph) => state.runtime.observe(graph)

const isPair = Array.isArray

const withState = (state, changes) => ({
  ...state,
  ...changes,
})

const chain = (first, rest) =>
  rest.reduce((left, right) => [left, right], first)

const ast = term => {
  if (!isPair(term)) return String(term)
  if (!term.length) return []

  return chain(ast(term[0]), term.slice(1).map(ast))
}

const unchain = term => {
  if (!isPair(term) || !term.length) {
    return { args: [], first: term }
  }

  const prefix = unchain(term[0])
  return {
    args: [...prefix.args, term[1]],
    first: prefix.first,
  }
}

const resolveTerm = (term, aliases, seen = []) => {
  if (typeof term === 'string' && aliases.has(term)) {
    if (seen.includes(term)) {
      throw new Error(`cyclic alias: ${[...seen, term].join(' -> ')}`)
    }

    return resolveTerm(aliases.get(term), aliases, [...seen, term])
  }

  if (!isPair(term) || !term.length) return term

  return [
    resolveTerm(term[0], aliases, seen),
    resolveTerm(term[1], aliases, seen),
  ]
}

const createPattern = (state, depth) => {
  let pattern = state.runtime.I
  for (let i = 0; i <= depth; i += 1) {
    pattern = state.runtime.pair(state.runtime.I, pattern)
  }

  return pattern
}

/**
 * Returns the graph pattern used for a source symbol.
 *
 * Symbols are not strings in the graph. The compiler maps each name to a
 * stable pair pattern and reuses that pattern whenever the name appears again,
 * which makes repeated source symbols shared graph nodes. A new symbol returns
 * a new compiler state; an existing symbol returns the same state.
 *
 * @param {CompilerState} state
 * @param {string} name
 * @returns {[CompilerState, Graph]}
 */
export const symbol = (state, name) => {
  if (state.symbols.has(name)) return [state, state.symbols.get(name)]

  const symbols = new Map(state.symbols)
  const graph = createPattern(state, symbols.size)
  symbols.set(name, graph)

  return [withState(state, { symbols }), graph]
}

const sameShape = (state, left, right) => {
  if (
    state.runtime.equal(left, state.runtime.I)
      || state.runtime.equal(right, state.runtime.I)
  ) {
    return state.runtime.equal(left, right)
  }

  return sameShape(state, state.runtime.left(left), state.runtime.left(right))
    && sameShape(state, state.runtime.right(left), state.runtime.right(right))
}

const knownSymbol = (state, graph) => {
  for (const [name, pattern] of state.symbols) {
    if (sameShape(state, graph, pattern)) return name
  }
}

/**
 * Serializes a graph back into readable source-like text.
 *
 * Known symbol patterns are printed by name, the state's root is printed as
 * `()`, ordinary pairs are printed as binary forms, and cycles are printed by
 * the first path that reached them.
 *
 * @param {CompilerState} state
 * @param {Graph} graph
 * @param {string} [path]
 * @param {Map<Graph, string>} [seen]
 * @returns {string}
 */
export const serialize = (state, graph, path = '$', seen = new Map()) => {
  if (state.runtime.equal(graph, state.runtime.I)) return '()'

  const name = knownSymbol(state, graph)
  if (name) return name

  if (seen.has(graph)) return seen.get(graph)
  seen.set(graph, path)

  return [
    '(',
    serialize(state, state.runtime.left(graph), `${path}[0]`, seen),
    ' ',
    serialize(state, state.runtime.right(graph), `${path}[1]`, seen),
    ')',
  ].join('')
}

const chainArgs = (state, graphs) =>
  graphs.length
    ? chain(graphs[0], graphs.slice(1))
    : state.runtime.I

const closureGraph = (state, closure) =>
  state.runtime.pair(chainArgs(state, closure.values), state.runtime.I)

const compileArgs = (state, args, bindings) =>
  args.reduce(
    ([nextState, graphs], arg) => {
      const [argState, compiled] = compileNode(nextState, arg, bindings)
      return [argState, [...graphs, compiled.graph]]
    },
    [state, []]
  )

const pairDefinition = (
  state,
  definition,
  prefixGraphs,
  args,
  bindings
) => {
  const [argsState, graphs] = compileArgs(state, args, bindings)
  const allGraphs = [...prefixGraphs, ...graphs]

  if (allGraphs.length < definition.params.length) {
    const closure = { definition, values: allGraphs }
    return [
      argsState,
      { closure, graph: closureGraph(argsState, closure) },
    ]
  }

  const used = allGraphs.slice(0, definition.params.length)
  const rest = allGraphs.slice(definition.params.length)
  const nextBindings = new Map(bindings)
  definition.params.forEach((name, index) =>
    nextBindings.set(name, used[index])
  )

  const [bodyState, body] = compileNode(
    argsState,
    definition.body,
    nextBindings
  )
  const graph = rest.reduce(
    (left, right) => bodyState.runtime.pair(left, right),
    body.graph
  )

  return [bodyState, {
    graph,
    pair: chainArgs(bodyState, allGraphs),
  }]
}

const compileNode = (state, term, bindings = new Map()) => {
  if (typeof term === 'string') {
    if (bindings.has(term)) return [state, { graph: bindings.get(term) }]
    if (state.closures.has(term)) {
      const closure = state.closures.get(term)
      return [state, { closure, graph: closureGraph(state, closure) }]
    }

    const resolved = resolveTerm(term, state.aliases)
    if (resolved !== term) return compileNode(state, resolved, bindings)

    const [symbolState, graph] = symbol(state, term)
    return [symbolState, { graph }]
  }

  if (!isPair(term) || !term.length) {
    return [state, { graph: state.runtime.I }]
  }

  const { args, first } = unchain(term)
  const resolvedFirst = typeof first === 'string'
    ? resolveTerm(first, state.aliases)
    : first

  if (
    typeof resolvedFirst === 'string'
      && state.definitions.has(resolvedFirst)
  ) {
    return pairDefinition(
      state,
      state.definitions.get(resolvedFirst),
      [],
      args,
      bindings
    )
  }

  if (typeof resolvedFirst === 'string' && state.closures.has(resolvedFirst)) {
    const closure = state.closures.get(resolvedFirst)
    return pairDefinition(
      state,
      closure.definition,
      closure.values,
      args,
      bindings
    )
  }

  if (resolvedFirst !== first) {
    return compileNode(state, chain(resolvedFirst, args), bindings)
  }

  const [leftState, left] = compileNode(state, term[0], bindings)
  const [rightState, right] = compileNode(leftState, term[1], bindings)

  return [rightState, {
    graph: rightState.runtime.pair(left.graph, right.graph),
  }]
}

const graphFor = (state, compiled) => {
  if (compiled.pair) {
    const graph = state.runtime.pair()
    state.runtime.setLeft(graph, state.runtime.pair(graph, compiled.graph))
    state.runtime.setRight(graph, compiled.pair)

    return state.runtime.frame(graph, graph)
  }

  return state.runtime.frame(
    state.runtime.I,
    state.runtime.pair(state.runtime.I, compiled.graph)
  )
}

const compileAst = (state, sourceAst) => {
  const form = resolveTerm(sourceAst, state.aliases)
  const [nextState, compiled] = compileNode(state, form)

  return [nextState, graphFor(nextState, compiled)]
}

const withoutName = (state, name) => {
  const aliases = new Map(state.aliases)
  const closures = new Map(state.closures)
  const definitions = new Map(state.definitions)

  aliases.delete(name)
  closures.delete(name)
  definitions.delete(name)

  return withState(state, { aliases, closures, definitions })
}

const setAlias = (state, name, sourceAst) => {
  const nextState = withoutName(state, name)
  const aliases = new Map(nextState.aliases)
  aliases.set(name, sourceAst)

  return withState(nextState, { aliases })
}

const setClosure = (state, name, closure) => {
  const nextState = withoutName(state, name)
  const closures = new Map(nextState.closures)
  closures.set(name, closure)

  return withState(nextState, { closures })
}

const setDefinition = (state, name, definition) => {
  const nextState = withoutName(state, name)
  const definitions = new Map(nextState.definitions)
  definitions.set(name, definition)

  return withState(nextState, { definitions })
}

const compileValueDefinition = (state, name, value) => {
  const sourceAst = ast(value)
  const [compiledState, compiled] = compileNode(state, sourceAst)

  if (compiled.closure) {
    return [setClosure(compiledState, name, compiled.closure), null]
  }

  return [setAlias(compiledState, name, sourceAst), null]
}

const compileFunctionDefinition = (state, signature, body) => {
  const [name, ...params] = signature.map(String)
  const definition = {
    body: ast(body),
    params,
  }

  return [setDefinition(state, name, definition), null]
}

const compileDefine = (state, form) => {
  if (isPair(form[1])) {
    return compileFunctionDefinition(state, form[1], form[2])
  }

  return compileValueDefinition(state, String(form[1]), form[2])
}

const compileForm = (state, form) => {
  if (isPair(form) && form[0] === 'define') {
    return compileDefine(state, form)
  }

  return compileAst(state, ast(form))
}

/**
 * Compiles parsed top-level forms into a passive observation frame.
 *
 * Definition forms update the compiler's source tables and return a new state.
 * Expression forms build graph structure, and the final expression frame is
 * returned for observation. Compilation stops before reduction; callers run
 * `observe(state, graph)` explicitly.
 *
 * @param {CompilerState} state
 * @param {SourceForm[]} forms
 * @returns {[CompilerState, Graph]}
 */
export const compile = (state, forms) => {
  const [nextState, graph] = forms.reduce(
    ([currentState, currentGraph], form) => {
      const [formState, formGraph] = compileForm(currentState, form)
      return [formState, formGraph ?? currentGraph]
    },
    [state, null]
  )

  return [
    nextState,
    graph ?? nextState.runtime.frame(nextState.runtime.I, nextState.runtime.I),
  ]
}
