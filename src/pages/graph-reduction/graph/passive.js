export const pair = (left, right) =>
  [left, right]

export const fixed = () => {
  const node = []

  node[0] = node
  node[1] = node
  return node
}

export const frame = (observer, focus) =>
  pair(observer, focus)

export const linked = (observer, focus, future = observer) =>
  frame(observer, pair(focus, future))

export const returned = (observer, focus) =>
  focus[0] === observer

export const read = ([observer, focus], trace) => (
  trace?.(focus),
  returned(observer, focus)
    ? focus[1]
    : read(frame(observer, focus[0]), trace))

export const step = ([observer, [focus, future]]) =>
  returned(observer, focus)
    ? focus[1]
    : future

export const create = ([observer, focus]) =>
  returned(observer, focus)
    ? focus[1]
    : frame(observer, focus[0])
