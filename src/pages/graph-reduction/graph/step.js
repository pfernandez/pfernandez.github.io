const delayed = new WeakMap()

export const delay = (pair, force) =>
  delayed.set(pair, force)

// One machine step: materialize a delayed edge if this pair owns one, then move
// to the right edge. The ordinary case remains a plain right-edge read.

export const step = pair => {
  const force = delayed.get(pair)

  if (force) {
    delayed.delete(pair)
    force()
  }

  return pair[1]
}
