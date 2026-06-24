export const observe = (pair, trace) => (
  trace?.(pair),
  pair[0] === pair ? pair[1]
    : observe(pair[0], trace))
