export const I = 0

export const createHeap = () => ({ left: [I], right: [I] })

export const alloc = (heap, left = I, right = I) => {
  const pointer = heap.left.length
  heap.left[pointer] = left
  heap.right[pointer] = right

  return pointer
}

export const left = (heap, pointer) => heap.left[pointer]

export const right = (heap, pointer) => heap.right[pointer]

export const setLeft = (heap, pointer, value) => {
  heap.left[pointer] = value
  return pointer
}

export const setRight = (heap, pointer, value) => {
  heap.right[pointer] = value
  return pointer
}

export const size = heap => heap.left.length - 1

export const pair = (heap, first = I, next = I) =>
  alloc(heap, first, next)

export const collapse = (heap, next = I) => pair(heap, I, next)

export const fix = (heap, next = I) => {
  const root = pair(heap)
  setLeft(heap, root, collapse(heap, root))
  setRight(heap, root, next)
  return root
}

export const share = (heap, first, second, argument) =>
  pair(
    heap,
    pair(heap, first, argument),
    pair(heap, second, argument)
  )

export const observe = (heap, focus) => {
  let current = focus

  while (true) {
    const first = left(heap, current)
    if (first === I) return right(heap, current)
    current = first
  }
}
