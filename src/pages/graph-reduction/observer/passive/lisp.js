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
 * @property {Compiled[]} values
 *
 * @typedef {object} Compiled
 * @property {Closure} [closure]
 * @property {Graph} graph
 * @property {Graph} [pair]
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
 * @property {Map<string, Graph>} values
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
 * closures, recursive values, and symbol patterns. Compiler functions return a
 * new state when those tables change instead of mutating hidden module state.
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
  values: new Map(),
})

/**
 * Parses Lisp source into literal top-level source forms.
 *
 * This is a thin wrapper around the page parser so the passive Lisp pipeline is
 * readable at the call site:
 * `parse(source) -> compile(state, forms) -> state.runtime.observe(graph)`.
 *
 * @param {string} source
 * @returns {SourceForm[]}
 */
export const parse = source => read(source)

/**
 * Small source-level kernel for the passive Lisp prototype.
 *
 * These are ordinary definitions, not runtime primitives. Loading the kernel
 * means compiling this source into the compiler state, so calls still reduce by
 * graph construction followed by one runtime observation.
 *
 * @type {string}
 */
export const kernelSource = `
  (define (I x) x)
  (define (K a b) a)
  (define (S a b c) ((a c) (b c)))
  (define (true a b) a)
  (define (false a b) b)
  (define (not p a b) (p b a))
  (define (and p q a b) (p (q a b) b))
  (define (or p q a b) (p a (q a b)))
  (define (pair a b f) (f a b))
  (define (first p) (p true))
  (define (second p) (p false))
  (define (zero f x) x)
  (define (one f x) (f x))
  (define (two f x) (f (f x)))
  (define (succ n f x) (f (n f x)))
  (define (add m n f x) (m f (n f x)))
  (define (mul m n f x) (m (n f) x))
  (define (is-zero n a b) (n (K b) a))
`

const isPair = Array.isArray

const withState = (state, changes) => ({
  ...state,
  ...changes,
})

const chain = (first, rest) =>
  rest.reduce((left, right) => [left, right], first)

const chainRuntime = (state, first, rest) =>
  rest.reduce((left, right) => state.runtime.pair(left, right), first)

const ast = term => {
  if (!isPair(term)) return String(term)
  if (!term.length) return []

  return chain(ast(term[0]), term.slice(1).map(ast))
}

const containsName = (term, name) => {
  if (term === name) return true
  if (!isPair(term)) return false

  return term.some(value => containsName(value, name))
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

const knownValue = (state, graph) => {
  for (const [name, value] of state.values) {
    if (state.runtime.equal(graph, value)) return name
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

  const valueName = knownValue(state, graph)
  if (valueName) return valueName

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

const chainArgs = (state, values) =>
  values.length
    ? chainRuntime(
        state,
        values[0].graph,
        values.slice(1).map(value => value.graph)
      )
    : state.runtime.I

const closureGraph = (state, closure) =>
  state.runtime.pair(chainArgs(state, closure.values), state.runtime.I)

const compileArgs = (state, args, bindings) =>
  args.reduce(
    ([nextState, values], arg) => {
      const [argState, compiled] = compileNode(nextState, arg, bindings)
      return [argState, [...values, compiled]]
    },
    [state, []]
  )

const pairDefinition = (
  state,
  definition,
  prefixValues,
  args,
  bindings
) => {
  const [argsState, values] = compileArgs(state, args, bindings)
  const allValues = [...prefixValues, ...values]

  if (allValues.length < definition.params.length) {
    const closure = { definition, values: allValues }
    return [
      argsState,
      { closure, graph: closureGraph(argsState, closure) },
    ]
  }

  const used = allValues.slice(0, definition.params.length)
  const rest = allValues.slice(definition.params.length)
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
    (left, right) => bodyState.runtime.pair(left, right.graph),
    body.graph
  )

  return [bodyState, {
    graph,
    pair: chainArgs(bodyState, allValues),
  }]
}

const compileNode = (state, term, bindings = new Map()) => {
  if (typeof term === 'string') {
    if (bindings.has(term)) return [state, bindings.get(term)]
    if (state.values.has(term)) {
      return [state, { graph: state.values.get(term) }]
    }
    if (state.closures.has(term)) {
      const closure = state.closures.get(term)
      return [state, { closure, graph: closureGraph(state, closure) }]
    }
    if (state.definitions.has(term)) {
      const closure = {
        definition: state.definitions.get(term),
        values: [],
      }
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

  const [firstState, firstValue] = compileNode(state, resolvedFirst, bindings)
  if (firstValue.closure) {
    return pairDefinition(
      firstState,
      firstValue.closure.definition,
      firstValue.closure.values,
      args,
      bindings
    )
  }

  const [argsState, values] = compileArgs(firstState, args, bindings)

  return [argsState, {
    graph: chainRuntime(
      argsState,
      firstValue.graph,
      values.map(value => value.graph)
    ),
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

const targetFor = (state, compiled) => ({
  frame: graphFor(state, compiled),
  result: compiled.graph,
})

const compileAstTarget = (state, sourceAst) => {
  const form = resolveTerm(sourceAst, state.aliases)
  const [nextState, compiled] = compileNode(state, form)

  return [nextState, targetFor(nextState, compiled)]
}

const compileAst = (state, sourceAst) => {
  const [nextState, target] = compileAstTarget(state, sourceAst)

  return [nextState, target.frame]
}

const withoutName = (state, name) => {
  const aliases = new Map(state.aliases)
  const closures = new Map(state.closures)
  const definitions = new Map(state.definitions)
  const values = new Map(state.values)

  aliases.delete(name)
  closures.delete(name)
  definitions.delete(name)
  values.delete(name)

  return withState(state, { aliases, closures, definitions, values })
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

const reserveValue = (state, name) => {
  const nextState = withoutName(state, name)
  const graph = nextState.runtime.pair()
  const values = new Map(nextState.values)
  values.set(name, graph)

  return [withState(nextState, { values }), graph]
}

const copyPair = (state, target, source) => {
  state.runtime.setLeft(target, state.runtime.left(source))
  state.runtime.setRight(target, state.runtime.right(source))

  return target
}

const compileRecursiveValueDefinition = (state, name, sourceAst) => {
  const [reservedState, value] = reserveValue(state, name)
  const [compiledState, compiled] = compileNode(reservedState, sourceAst)

  copyPair(compiledState, value, compiled.graph)

  return [compiledState, null]
}

const compileValueDefinition = (state, name, value) => {
  const sourceAst = ast(value)

  if (containsName(sourceAst, name)) {
    return compileRecursiveValueDefinition(state, name, sourceAst)
  }

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

const compileFormTarget = (state, form) => {
  if (isPair(form) && form[0] === 'define') {
    return compileDefine(state, form)
  }

  return compileAstTarget(state, ast(form))
}

const emptyTarget = state => ({
  frame: state.runtime.frame(state.runtime.I, state.runtime.I),
  result: state.runtime.I,
})

const machineFor = (state, targets) => {
  const root = state.runtime.pair()
  const input = state.runtime.pair()
  const output = state.runtime.pair()
  const inputEvent = state.runtime.pair(input, state.runtime.I)
  const ports = state.runtime.pair(inputEvent, targets[0].frame)
  const states = targets.map(() => state.runtime.pair())
  state.runtime.setLeft(root, ports)
  state.runtime.setRight(root, states[0])

  states.forEach((current, index) => {
    const next = states[(index + 1) % states.length]
    const outputEvent = state.runtime.pair(output, targets[index].result)
    state.runtime.setLeft(
      current,
      state.runtime.pair(
        state.runtime.pair(root, next),
        outputEvent
      )
    )
    state.runtime.setRight(current, next)
  })

  return root
}

/**
 * Compiles parsed top-level forms into a passive observation frame.
 *
 * Definition forms update the compiler's source tables and return a new state.
 * Expression forms build graph structure, and the final expression frame is
 * returned for observation. Compilation stops before reduction; callers run
 * the selected runtime's unary `observe(graph)` explicitly.
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

/**
 * Compiles parsed forms into a root whose current state can advance by `right`.
 *
 * This is the experimental machine target for the passive compiler. It reuses
 * the same source compiler as `compile`, but wraps the selected graph in the
 * step-shaped state proved in `machines.test.js`: the current state's right
 * slot is the next state, and its left slot carries both the observer collapse
 * link and the current output event.
 *
 * @param {CompilerState} state
 * @param {SourceForm[]} forms
 * @returns {[CompilerState, Graph]}
 */
export const compileMachine = (state, forms) => {
  const [nextState, targets] = forms.reduce(
    ([currentState, currentTargets], form) => {
      const [formState, formTarget] = compileFormTarget(currentState, form)
      return [
        formState,
        formTarget ? [...currentTargets, formTarget] : currentTargets,
      ]
    },
    [state, []]
  )

  return [
    nextState,
    machineFor(
      nextState,
      targets.length ? targets : [emptyTarget(nextState)]
    ),
  ]
}

/**
 * Returns the current state carried by a compiled machine root.
 *
 * The machine root's right slot is the only mutable current pointer in this
 * protocol. The state graph itself remains an ordinary pair graph.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineCurrent = (state, machine) =>
  state.runtime.right(machine)

/**
 * Reads the current output event carried by a compiled machine root.
 *
 * An output event is `[output, value]`: the stable output socket on the left
 * and the emitted value on the right.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineOutputEvent = (state, machine) =>
  state.runtime.right(state.runtime.left(machineCurrent(state, machine)))

/**
 * Reads the stable output socket carried by a compiled machine root.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineOutputSocket = (state, machine) =>
  state.runtime.left(machineOutputEvent(state, machine))

/**
 * Reads the value carried by the current machine output event.
 *
 * Reading it does not observe, reduce, or advance the machine.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineOutput = (state, machine) =>
  state.runtime.right(machineOutputEvent(state, machine))

/**
 * Advances a compiled machine root to its next state.
 *
 * This is the small host-side mutation needed on current CPUs: update the
 * root's current pointer to the current state's right slot. The graph contains
 * the next relation; this function only moves the pointer that says which state
 * is current.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineStep = (state, machine) => {
  const next = state.runtime.right(machineCurrent(state, machine))
  state.runtime.setRight(machine, next)

  return next
}

/**
 * Reads the current input event carried by a compiled machine root.
 *
 * An input event is `[input, value]`: the stable input socket on the left and
 * the submitted value on the right. The initial event carries `I` as value.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineInputEvent = (state, machine) =>
  state.runtime.left(state.runtime.left(machine))

/**
 * Reads the stable input socket carried by a compiled machine root.
 *
 * The socket is an ordinary pair that stays fixed. Host input arrives by
 * replacing the machine port with a fresh event pair whose left slot points to
 * this socket and whose right slot carries the submitted graph value.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineInput = (state, machine) =>
  state.runtime.left(machineInputEvent(state, machine))

/**
 * Reads the graph carried by the machine's current input event.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineInputValue = (state, machine) =>
  state.runtime.right(machineInputEvent(state, machine))

/**
 * Connects a graph to the machine through a fresh input event.
 *
 * This is host IO, not evaluation: the stable input socket is not mutated.
 * The only mutation is moving the machine's port pointer to a newly allocated
 * event pair.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @param {Graph} value
 * @returns {Graph}
 */
export const machineWriteInput = (state, machine, value) => {
  const input = machineInput(state, machine)
  const event = state.runtime.pair(input, value)
  state.runtime.setLeft(state.runtime.left(machine), event)

  return event
}

/**
 * Reads the current output, then advances the machine to the next state.
 *
 * This is the smallest REPL-shaped machine tick: output is read through the
 * machine protocol, and the only mutation is the root's current pointer.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @returns {Graph}
 */
export const machineStepOutput = (state, machine) => {
  const output = machineOutput(state, machine)
  machineStep(state, machine)

  return output
}

/**
 * Runs one source interaction through a compiled machine boundary.
 *
 * The source is parsed, compiled, and observed once to produce a graph value.
 * That value is connected to the machine as a fresh input event, then the
 * current machine output is read and the machine advances one state.
 *
 * This is host IO around the machine, not internal machine evaluation.
 *
 * @param {CompilerState} state
 * @param {Graph} machine
 * @param {string} source
 * @returns {[CompilerState, Graph]}
 */
export const machineSourceStep = (state, machine, source) => {
  const [nextState, graph] = compile(state, parse(source))
  const input = nextState.runtime.observe(graph)
  machineWriteInput(nextState, machine, input)

  return [nextState, machineStepOutput(nextState, machine)]
}

/**
 * Runs one source interaction through the passive boundary.
 *
 * This is the smallest REPL-shaped step: parse source text, compile it into a
 * graph frame, then observe that frame once with the selected runtime. It
 * returns the next compiler state and the observed graph; callers serialize
 * explicitly when they need text output.
 *
 * @param {CompilerState} state
 * @param {string} source
 * @returns {[CompilerState, Graph]}
 */
export const sourceStep = (state, source) => {
  const [nextState, graph] = compile(state, parse(source))

  return [nextState, nextState.runtime.observe(graph)]
}
