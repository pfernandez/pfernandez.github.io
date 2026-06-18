export const observe = (pair, trace) => (
  trace?.(pair),
  pair[0] === pair ? pair
    : observe(pair[0], trace))

export const select = found =>
  found[1]
