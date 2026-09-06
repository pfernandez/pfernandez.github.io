import { isFixed } from '../../graph/helpers.js'

const pair = (left, right) => Object.freeze([left, right])
const frame = (environment, work, focus) =>
  pair(environment, pair(work, focus))
const environment = state => state[0]
const work = state => state[1][0]

export const focus = state => state[1][1]
export const pending = state => !isFixed(work(state))

const find = (parameter, graph) => {
  if (isFixed(graph)) return
  const [previous, binding] = graph
  return binding[0] === parameter
    ? binding[1]
    : find(parameter, previous)
}

/** Begin matching one transition input with one argument. */
export const begin = (transition, argument, origin) => frame(
  origin,
  pair(origin, pair(transition[0], argument)),
  transition[1]
)

/** Consume one input equation and expose the next matching frame. */
export const identify = state => {
  if (!pending(state)) return state

  const bindings = environment(state)
  const [previous, equation] = work(state)
  const [pattern, value] = equation
  const known = find(pattern, bindings)

  if (known && known !== value)
    throw new TypeError('Argument does not match transition input')
  if (known) return frame(bindings, previous, focus(state))
  if (isFixed(pattern)) return frame(
    pair(bindings, equation),
    previous,
    focus(state)
  )
  if (isFixed(value))
    throw new TypeError('Argument does not match transition input')

  const right = pair(pattern[1], value[1])
  const left = pair(pattern[0], value[0])
  return frame(
    bindings,
    pair(pair(previous, right), left),
    focus(state)
  )
}

/** Select one side and begin resolving it through the environment. */
export const select = (state, side) => {
  if (pending(state))
    throw new TypeError('Cannot select while work remains')

  const selected = focus(state)[side]
  return frame(
    environment(state),
    isFixed(selected) ? environment(state) : work(state),
    selected
  )
}

/** Search one local binding while retaining the complete environment. */
export const resolve = state => {
  if (!pending(state)) return state

  const [previous, binding] = work(state)
  return binding[0] === focus(state)
    ? frame(environment(state), binding[0], binding[1])
    : frame(environment(state), previous, focus(state))
}

/** Record every pair-local state transition until no work remains. */
export const run = (state, advance, origin, history = origin) => {
  if (!pending(state)) return { history, state }

  const next = advance(state)
  return run(next, advance, origin, pair(history, pair(state, next)))
}
