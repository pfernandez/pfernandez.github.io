export const EMPTY = 0

export const createHeap = () => ({
  left: [EMPTY],
  right: [EMPTY]
})

export const alloc = (heap, left = EMPTY, right = EMPTY) => {
  const pointer = heap.left.length
  heap.left[pointer] = left
  heap.right[pointer] = right
  return pointer
}

export const left = (heap, pointer) => (
  pointer === EMPTY ? EMPTY : heap.left[pointer]
)

export const right = (heap, pointer) => (
  pointer === EMPTY ? EMPTY : heap.right[pointer]
)

export const setLeft = (heap, pointer, value) => {
  heap.left[pointer] = value
  return pointer
}

export const setRight = (heap, pointer, value) => {
  heap.right[pointer] = value
  return pointer
}

export const size = heap => heap.left.length - 1

export const isEmpty = pointer => pointer === EMPTY

export const isStable = (heap, pointer) => (
  !isEmpty(pointer) && left(heap, pointer) === EMPTY
)

export const pair = (heap, leftValue, rightValue) => (
  alloc(heap, leftValue, rightValue)
)

export const application = (heap, operator, operand) => (
  pair(heap, operator, operand)
)

export const stable = (heap, value) => pair(heap, EMPTY, value)

export const observe = (heap, focus) => {
  let current = focus

  while (!isEmpty(current)) {
    const next = left(heap, current)
    if (isEmpty(next)) return right(heap, current)
    current = next
  }

  return EMPTY
}

export const I = (heap, value) => stable(heap, value)

export const keep = (heap, kept, ignored) => (
  pair(heap, stable(heap, kept), ignored)
)

export const chooseRight = (heap, ignored, kept) => (
  pair(heap, stable(heap, kept), ignored)
)

export const exposePair = (heap, leftValue, rightValue) => (
  stable(heap, pair(heap, leftValue, rightValue))
)

export const share = (heap, first, second, argument) => {
  const leftApplication = application(heap, first, argument)
  const rightApplication = application(heap, second, argument)
  const result = pair(heap, leftApplication, rightApplication)

  return stable(heap, result)
}

export const fix = (heap, payload = EMPTY) => {
  const root = pair(heap, EMPTY, EMPTY)
  const cycle = pair(heap, stable(heap, root), payload)

  return setLeft(heap, root, cycle)
}

export const createRoot = (heap, current = EMPTY) => (
  stable(heap, current)
)

export const carry = (heap, root, previous = EMPTY) => (
  pair(heap, root, previous)
)

export const setCurrent = (heap, root, current) => (
  setRight(heap, root, current)
)
