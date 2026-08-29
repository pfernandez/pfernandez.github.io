import { isOpen } from './pair.js'

/** Close construction frontiers and freeze one complete pair graph. */
export const finalize = composed => {
  const seen = new Set()

  const freeze = graph => {
    if (!Array.isArray(graph) || seen.has(graph)) return graph

    seen.add(graph)
    if (isOpen(graph)) graph[1] = graph
    graph.forEach(freeze)
    return Object.freeze(graph)
  }

  freeze(composed.graph)
  return composed
}
