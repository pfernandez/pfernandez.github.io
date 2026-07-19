export const step = state =>
  state[1]

export const event = state =>
  state[0]

export const previous = event =>
  event[1][0]

export const output = event =>
  event[1][1]

export const historyDepth = (event, root) =>
  event === root ? 0 : 1 + historyDepth(previous(event), root)
