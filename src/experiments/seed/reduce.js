import { isFixed } from '../../graph/helpers.js'

const pair = (left, right) => Object.freeze([left, right])
const close = (environment, graph) => pair(environment, graph)
const environment = closure => closure[0]
const graph = closure => closure[1]
const stack = state => state[0]
const term = state => state[1]
const state = (stack, term) => pair(stack, term)

export const isDefinition = graph =>
  graph[0] === graph && graph[1] !== graph

const find = (parameter, bindings) => {
  if (isFixed(bindings)) return
  const [previous, binding] = bindings
  return binding[0] === parameter
    ? binding[1]
    : find(parameter, previous)
}

const dereference = closure => {
  const value = find(graph(closure), environment(closure))
  return value ? dereference(value) : closure
}

const select = (closure, side) => {
  const current = dereference(closure)
  return dereference(close(environment(current), graph(current)[side]))
}

const apply = (fn, argument) => {
  const callable = dereference(fn)
  const identity = graph(callable)
  if (isFixed(identity)) return argument
  if (!isDefinition(identity))
    throw new TypeError('Application did not produce a definition')

  const [parameter, body] = identity[1]
  if (!isFixed(parameter))
    throw new TypeError('Definition input must be one identity')

  return close(
    pair(environment(callable), pair(parameter, argument)),
    body
  )
}

/** Begin observing one expression from a fixed origin. */
export const begin = (expression, origin) => state(
  origin,
  close(origin, expression)
)

export const focus = state => graph(dereference(term(state)))

/** A value with no waiting argument is a recurrent observation. */
export const pending = state => {
  const current = focus(state)
  return !isFixed(stack(state))
    || !isFixed(current) && !isDefinition(current)
}

/** Perform one normal-order transition without copying a definition body. */
export const advance = current => {
  const closure = dereference(term(current))
  const expression = graph(closure)

  if (!isFixed(expression) && !isDefinition(expression))
    return state(
      pair(stack(current), select(closure, 1)),
      select(closure, 0)
    )

  const [previous, argument] = stack(current)
  return state(previous, apply(closure, argument))
}

/** Retain the complete sequence of machine transitions. */
export const run = (current, origin, history = origin) => {
  if (!pending(current)) return { history, state: current }

  const next = advance(current)
  return run(next, origin, pair(history, pair(current, next)))
}
