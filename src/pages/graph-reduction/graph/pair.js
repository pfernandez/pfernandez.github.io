export const isOpen = graph => Array.isArray(graph)
  && graph.length === 1
  && graph[0] === graph

export const isFixed = graph => Array.isArray(graph)
  && graph[0] === graph
  && graph[1] === graph
