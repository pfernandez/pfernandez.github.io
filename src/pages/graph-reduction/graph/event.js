import { step } from './step.js'

const atom = () => {
  const node = []
  node[0] = node[1] = node
  return node
}

export const event = focus =>
  [focus, atom()]

export const tick = (node, next = step) => {
  const focus = node[0]

  node[0] = next(focus)
  node[1] = [node[1], focus]
  return node
}

export const depth = node => {
  let count = 0
  let history = node[1]

  while (history[0] !== history) {
    count += 1
    history = history[0]
  }

  return count
}
