import { isFixed, isOpen } from './helpers.js'

const hold = value => {
  const graph = []
  graph[0] = graph
  graph[1] = value
  return graph
}

/** Follow construction-time selections to the identity they expose. */
const selected = (graph, results, selections, legend) => {
  if (legend.has(graph)) return graph
  const next = selections.get(graph) ?? results.get(graph)
  return next && next !== graph
    ? selected(next, results, selections, legend)
    : graph
}

/** Place each argument on the left of a recurrent frame. */
const frames = values => {
  const list = values.map(() => [])

  list.forEach((frame, index) => {
    frame[0] = values[index]
    frame[1] = list[index + 1] ?? frame
  })

  return list[0]
}

/**
 * Turn compiler selections into graph structure before observation begins.
 *
 * The composed graph remains the construction history. A device observation
 * receives recurrent argument frames whose left sides are the selected values.
 * The projector can therefore read only pairs; it does not need compiler maps.
 */
export const materialize = composed => {
  const { inputs, legend, results, selections } = composed
  if (!inputs.size) return composed

  const memo = new Map()
  const entry = graph => legend.get(graph)
  const isCall = graph => inputs.has(graph)
  const boundary = graph =>
    legend.has(graph) || isCall(graph) || results.has(graph)
  const argumentList = graph => boundary(graph)
    ? [graph]
    : [graph[0], ...argumentList(graph[1])]
  const argumentsOf = graph => {
    const value = selected(graph, results, selections, legend)
    return value === graph
      ? argumentList(graph).map(argument =>
        selected(argument, results, selections, legend))
      : [value]
  }

  const visit = source => {
    const graph = selected(source, results, selections, legend)
    if (memo.has(graph)) return memo.get(graph)
    if (!Array.isArray(graph) || isOpen(graph) || isFixed(graph))
      return graph

    const target = []
    memo.set(graph, target)
    if (legend.has(graph)) legend.set(target, legend.get(graph))

    if (isCall(graph)) {
      target[0] = visit(graph[0])
      target[1] = hold(entry(graph[0])?.capability?.raw
        ? graph[1]
        : frames(argumentsOf(inputs.get(graph)).map(visit)))
    } else {
      target[0] = visit(graph[0])
      target[1] = graph[1] === graph ? target : visit(graph[1])
    }

    return target
  }

  const entrypoint = visit(composed.result ?? composed.focus)
  const graph = entrypoint === composed.graph
    ? composed.graph
    : [composed.graph, entrypoint]

  return { graph, focus: entrypoint, result: entrypoint, legend }
}
