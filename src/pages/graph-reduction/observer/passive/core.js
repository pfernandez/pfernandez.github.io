export const EMPTY = 0

export const createHeap = () => ({ left: [EMPTY], right: [EMPTY] })

export const alloc = (heap, left = EMPTY, right = EMPTY) => {
  const pointer = heap.left.length
  heap.left[pointer] = left
  heap.right[pointer] = right

  return pointer
}

export const left = (heap, pointer) =>
  pointer === EMPTY ? EMPTY : heap.left[pointer]

export const right = (heap, pointer) =>
  pointer === EMPTY ? EMPTY : heap.right[pointer]

export const setLeft = (heap, pointer, value) => {
  heap.left[pointer] = value
  return pointer
}

export const setRight = (heap, pointer, value) => {
  heap.right[pointer] = value
  return pointer
}

export const size = heap => heap.left.length - 1

export const observe = (heap, focus) => {
  let current = focus

  while (current !== EMPTY) {
    const next = left(heap, current)
    if (next === EMPTY) return right(heap, current)
    current = next
  }

  return EMPTY
}
