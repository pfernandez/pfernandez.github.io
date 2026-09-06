import { isFixed } from '../../graph/helpers.js'

const pair = (left, right) => Object.freeze([left, right])

const empty = () => {
  const graph = []
  graph[0] = graph[1] = graph
  return Object.freeze(graph)
}

const find = (parameter, environment) => {
  if (isFixed(environment)) return
  const [previous, binding] = environment
  return binding[0] === parameter
    ? binding[1]
    : find(parameter, previous)
}

const match = (pattern, value, environment) => {
  const known = find(pattern, environment)

  if (known && known !== value)
    throw new TypeError('Argument does not match transition input')
  if (known) return environment
  if (isFixed(pattern))
    return pair(environment, pair(pattern, value))
  if (isFixed(value))
    throw new TypeError('Argument does not match transition input')

  return match(
    pattern[1],
    value[1],
    match(pattern[0], value[0], environment)
  )
}

const resolve = (graph, environment) => find(graph, environment) ?? graph

/** Enter a transition body while carrying its argument bindings. */
export const enter = (transition, argument) => pair(
  match(transition[0], argument, empty()),
  transition[1]
)

/** Return the identity currently visible through an observation. */
export const focus = ([environment, graph]) => resolve(graph, environment)

/** Enter one side while carrying the same local environment. */
export const select = ([environment, graph], side) => pair(
  environment,
  resolve(graph, environment)[side]
)
