export const observe = (pair, trace, graph = pair) =>
  (trace?.(pair),
  pair === graph ? pair[1] : observe(pair[0], trace, graph))
