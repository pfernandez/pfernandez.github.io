import { copyBody, copyConnected } from './copy.js'
import { isFixed, isOpen } from './helpers.js'

const append = (graph, node) => {
  if (isFixed(graph)) graph[1] = node
  else if (graph[0] === graph) {
    graph[0] = graph[1]
    graph[1] = node
  } else graph[1] = append(graph[1], node)

  return graph
}

/** Match definition inputs with arguments by identity and structure. */
const match = (input, args, parameters, bindings = []) => {
  const known = bindings.find(([node]) => node === input)?.[1]
  if (known) return known === args ? bindings : undefined

  let matched = parameters.has(input)
    ? [...bindings, [input, args]]
    : bindings
  if (isOpen(input) || isFixed(input)) return matched
  if (isOpen(args) || isFixed(args)) return

  if (parameters.has(input)
    && input[0] !== input
    && args[0] === args) return

  if (input[0] !== input) {
    matched = match(input[0], args[0], parameters, matched)
    if (!matched) return
  }
  if (input[1] !== input)
    matched = match(input[1], args[1], parameters, matched)
  return matched
}

/**
 * Materialize applications in an identity-connected graph.
 *
 * Composition never resolves a source spelling. Definition bodies already
 * point to their lexical dependencies, so this pass only matches identities,
 * substitutes arguments, preserves history, and ties recurring states.
 */
export const compose = connected => {
  const image = copyConnected(connected)
  const {
    calls,
    definitions,
    fills,
    legend,
    namedValues,
    owner,
    values
  } = image
  const materialized = new Map()
  const results = new Map()

  const context = (graph, focus = graph, result) =>
    ({ graph, focus, result })
  const output = state => state.result ?? state.focus
  const retain = (graph, state) => ({ ...state, graph })
  const exposed = graph => results.get(graph)
  const value = state => exposed(output(state)) ?? output(state)
  const callable = graph =>
    definitions.has(graph) || legend.get(graph)?.capability
  const suspended = graph => !legend.has(graph)
    && definitions.has(graph?.[0])
    && !results.has(graph)
  const applicable = graph => callable(graph) || suspended(graph)

  const walk = (
    expression,
    states = [],
    ownedBy = image.root,
    chain = true
  ) => {
    const known = materialized.get(expression)
    if (known) return context(exposed(known) ?? known)

    if (isOpen(expression)
      || isFixed(expression)
      || definitions.has(expression)
      || owner.get(expression) !== ownedBy)
      return context(expression)

    const graph = []
    const entry = legend.get(expression)
    if (entry) legend.set(graph, entry)
    if (namedValues.has(expression)) namedValues.add(graph)
    owner.set(graph, ownedBy)
    const left = expression[0]
    const right = expression[1]

    // A connected callable consumes the value exposed by its argument.
    if (calls.has(expression) && applicable(left)) {
      const argument = walk(right, states, ownedBy, chain)
      graph[0] = left
      graph[1] = value(argument)
      const applied = definitions.has(left) || suspended(left)
        ? instantiate(graph, states)
        : context(graph)
      if (namedValues.has(expression))
        materialized.set(expression, applied.graph)

      // A named recurrence remains an observable continuation whose right
      // edge enters the state that already exists.
      if (legend.has(expression) && applied.graph !== graph) {
        graph[0] = graph
        graph[1] = applied.graph
        return context(graph)
      }

      return argument.graph === output(argument)
        ? applied
        : retain([argument.graph, applied.graph], applied)
    }

    // A compound use of a bound input fills that input's open identity. If an
    // earlier use already filled it, every later use keeps the same identity.
    if (fills.has(expression)) {
      if (!isOpen(left)) return context(left)

      const following = walk(right, states, ownedBy, chain)
      left[0] = following.graph[0]
      left[1] = following.graph[1]
      return context(left)
    }

    // A self-edge is a named continuation, not a recursive descent.
    if (left === expression) {
      const following = walk(right, states, ownedBy, chain)
      graph[0] = graph
      graph[1] = following.graph
      return context(graph)
    }

    const previous = walk(left, states, ownedBy, chain)
    const following = right === expression
      ? context(graph)
      : walk(right, states, ownedBy, chain)
    graph[0] = previous.graph
    graph[1] = right === expression ? graph : following.graph
    // A named value is one identity even when its children are pairs.
    if (legend.has(expression) || values.has(expression))
      return context(graph)

    // A right state applies a value returned by a foreign call on its left.
    // The host result remains unknown until projection, so retain this pair as
    // the observable application.
    if (calls.has(left) && legend.get(left[0])?.capability)
      return context(graph)

    // Definitions and named values extend history while exposing the next
    // sibling. Their own results do not continue into that sibling.
    if (definitions.has(previous.focus)
      || namedValues.has(previous.focus))
      return retain(graph, following)

    // A later state completes the arguments of a suspended application.
    if (chain && suspended(previous.focus)) {
      const applied = instantiate(graph, states)
      return retain(graph, applied)
    }

    // A later state continues from the result of a completed application.
    if (chain && previous.result) {
      const application = graph[1] = [previous.result, graph[1]]
      owner.set(application, ownedBy)
      const applied = definitions.has(application[0])
        ? instantiate(application, states)
        : context(application, application, application)
      return retain(graph, applied)
    }

    if (!chain) return context(graph)
    return context(graph, following.focus, following.result)
  }

  // Apply a matching definition or return a previously constructed recurrence.
  const instantiate = (graph, states = []) => {
    let definition = graph[0]
    let args = graph[1]

    if (suspended(definition)) {
      args = append(definition[1], args)
      definition = definition[0]
      graph[0] = definition
      graph[1] = args
    }

    const defined = definitions.get(definition)
    if (!defined) return context(graph)

    const bindings = match(
      defined.input, args, defined.parameters)
    if (!bindings) return context(graph)

    const identity = bindings.filter(([input]) =>
      isFixed(input) || input[0] === input)
    const state = states.find(([known, previous]) =>
      known === definition
        && previous.length === identity.length
        && previous.every(([, arg], i) => arg === identity[i][1]))
    if (state)
      return context(state[2], state[2], exposed(state[2]) ?? state[2])

    states.push([definition, identity, graph])
    graph[0] = args
    const result = walk(
      copyBody(definition, bindings, image), states, definition, false)
    graph[1] = result.graph
    results.set(graph, output(result))
    return context(graph, graph, output(result))
  }

  const composed = walk(image.graph)
  if (suspended(composed.focus)) composed.focus = composed.focus[1]

  return {
    focus: composed.focus,
    graph: composed.graph,
    legend,
    result: composed.result
  }
}
