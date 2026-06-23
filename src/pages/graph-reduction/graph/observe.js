const isIdentity = node =>
  node?.[0] === node

const isActiveCall = pair =>
  isIdentity(pair[0])

export const observe = (pair, trace) => (
  trace?.(pair),
  isActiveCall(pair) ? pair
    : observe(pair[0], trace))

export const select = found =>
  found[1]
