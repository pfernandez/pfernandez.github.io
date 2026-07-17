import { observe } from '../observe.mjs'

const isPair = node => Array.isArray(node) && node.length !== 0

const isEmpty = node => Array.isArray(node) && node.length === 0

export const rightEmptyStep = node => {
  if (!isPair(node)) return node

  const [left, right] = node

  if (right === node || isEmpty(right)) return rightEmptyStep(left)

  const nextLeft = rightEmptyStep(left)
  if (nextLeft !== left) return [nextLeft, right]

  const nextRight = rightEmptyStep(right)
  if (nextRight !== right) return [left, nextRight]

  return node
}

export const eitherEmptyStep = node => {
  if (!isPair(node)) return node

  const [left, right] = node

  if (left === node || isEmpty(left)) return right
  if (right === node || isEmpty(right)) return left

  const nextLeft = eitherEmptyStep(left)
  if (nextLeft !== left) return [nextLeft, right]

  const nextRight = eitherEmptyStep(right)
  if (nextRight !== right) return [left, nextRight]

  return node
}

export const localOnlyStep = node => {
  if (!isPair(node)) return node

  const [left, right] = node

  if (left === node || isEmpty(left)) return right
  if (right === node || isEmpty(right)) return left

  return node
}

export const breadthFirstStep = node => {
  if (!isPair(node)) return node

  const [left, right] = node

  if (left === node || isEmpty(left)) return right
  if (right === node || isEmpty(right)) return left

  const nextLeft = breadthFirstStep(left)
  const nextRight = breadthFirstStep(right)

  if (nextLeft !== left || nextRight !== right) return [nextLeft, nextRight]

  return node
}

export const mutatingEitherStep = node => {
  if (!isPair(node)) return node

  const [left, right] = node

  if (left === node || isEmpty(left)) return right
  if (right === node || isEmpty(right)) return left

  const nextLeft = mutatingEitherStep(left)
  if (nextLeft !== left) {
    node[0] = nextLeft
    return node
  }

  const nextRight = mutatingEitherStep(right)
  if (nextRight !== right) {
    node[1] = nextRight
    return node
  }

  return node
}

export const steppers = [
  ['observe', observe],
  ['right-empty step', rightEmptyStep],
  ['either-empty step', eitherEmptyStep],
  ['local-only step', localOnlyStep],
  ['breadth-first step', breadthFirstStep],
  ['mutating either step', mutatingEitherStep],
]
