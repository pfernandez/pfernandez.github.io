import config from './config.lisp.js'
import {
  compile,
  init,
  kernelSource,
  parse,
  serialize,
  sourceStep
} from './lisp.js'

const stripComments = source =>
  source.replace(/;.*$/gm, '')

/**
 * Returns true when source has balanced parentheses.
 *
 * The parser is still the authority for syntax. This helper only lets the
 * interactive prompt know whether to keep collecting lines.
 *
 * @param {string} source
 * @returns {boolean}
 */
export const sourceComplete = source => {
  let depth = 0
  for (const char of stripComments(source)) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (depth < 0) return true
  }

  return depth === 0
}

/**
 * Creates the initial state for the CLI REPL.
 *
 * The REPL starts with the source kernel loaded by default so common basis
 * names are available immediately. Pass `{ kernel: false }` for an empty
 * source state.
 *
 * @param {{ kernel?: boolean }} [options]
 * @returns {import('./lisp.js').CompilerState}
 */
export const replState = (options = {}) => {
  if (options.kernel === false) return init()

  return sourceStep(init(), kernelSource)[0]
}

const exactName = (state, graph) => {
  for (const [name, value] of state.values) {
    if (state.runtime.equal(graph, value)) return name
  }

  for (const [name, value] of state.symbols) {
    if (state.runtime.equal(graph, value)) return name
  }
}

const traceText = (state, graph, path = '$', seen = new Map()) => {
  if (state.runtime.equal(graph, state.runtime.I)) return '()'

  const name = exactName(state, graph)
  if (name) return name

  if (!Array.isArray(graph)) return String(graph)
  if (seen.has(graph)) return seen.get(graph)
  seen.set(graph, path)

  return [
    '(',
    traceText(state, state.runtime.left(graph), `${path}[0]`, seen),
    ' ',
    traceText(state, state.runtime.right(graph), `${path}[1]`, seen),
    ')'
  ].join('')
}

const observeWithTrace = (state, graph, trace) => {
  const previousTrace = config.trace
  const previousTraceWalk = config.traceWalk
  const enabled = Array.isArray(trace)
  config.trace = enabled
  config.traceWalk = enabled
    ? focus => trace.push(traceText(state, focus))
    : undefined

  try {
    return state.runtime.observe(graph)
  } finally {
    config.trace = previousTrace
    config.traceWalk = previousTraceWalk
  }
}

/**
 * Runs one REPL source entry and returns the next state plus printable text.
 *
 * Definitions update the returned state. The final expression, when present,
 * is compiled, observed once, and serialized.
 *
 * @param {import('./lisp.js').CompilerState} state
 * @param {string} source
 * @param {{ trace?: boolean }} [options]
 * @returns {[import('./lisp.js').CompilerState, string, string[]]}
 */
export const replStep = (state, source, options = {}) => {
  const [nextState, graph] = compile(state, parse(source))
  const trace = []
  const shouldTrace = options.trace ?? config.trace
  const output = observeWithTrace(
    nextState,
    graph,
    shouldTrace ? trace : null
  )

  return [nextState, serialize(nextState, output), trace]
}
