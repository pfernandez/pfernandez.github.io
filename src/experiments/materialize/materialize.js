const pair = (left, right) => Object.freeze([left, right])

/** Construct the smallest recurrent identity. */
export const atom = () => {
  const identity = []
  identity[0] = identity[1] = identity
  return Object.freeze(identity)
}

/** A value and the observations constructed before it became available. */
export const value = (value, history = []) => ({ history, value })

/** Retain an authored observation in construction order. */
export const retain = graph => value(graph, [graph])

/** Retain earlier construction while exposing the final value. */
export const sequence = (...states) => value(
  states.at(-1).value,
  states.flatMap(state => state.history)
)

/** Materialize one application after everything needed by it already exists. */
export const apply = (definition, argument) => {
  const result = definition(argument.value)
  return value(result.value, [
    ...argument.history,
    ...result.history,
    pair(argument.value, result.value)
  ])
}

const freeze = (graph, seen = new Set()) => {
  if (!Array.isArray(graph) || seen.has(graph)) return graph
  seen.add(graph)
  graph.forEach(node => freeze(node, seen))
  return Object.freeze(graph)
}

/** Place each observation on the left of one observer frame. */
export const materialize = (state, repeat) => {
  const observations = state.history.length
    ? state.history
    : [state.value]
  const frames = observations.map(() => [])

  frames.forEach((frame, index) => {
    frame[0] = observations[index]
    frame[1] = frames[index + 1]
      ?? frames[repeat ?? index]
  })

  return freeze(frames[0])
}

/** The complete primitive transition rule. */
export const next = focus => focus[1]

/** Sample distinct frames by repeatedly applying the primitive transition. */
export const observe = (focus, visit, seen = new Set()) => {
  if (seen.has(focus)) return focus
  seen.add(focus)
  visit(focus[0], focus)
  return observe(next(focus), visit, seen)
}

export { pair }
