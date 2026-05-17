export const I = []
I[0] = I
I[1] = I

export const pair = (first = I, next = I) => {
  const node = [first, next]
  I.push(node)

  return node
}

export const left = node => node[0]

export const right = node => node[1]

export const setLeft = (node, value) => {
  node[0] = value
  return node
}

export const setRight = (node, value) => {
  node[1] = value
  return node
}

export const size = () => I.length - 2

export const collapse = (next = I) => pair(I, next)

export const fix = (next = I) => {
  const root = pair()
  setLeft(root, collapse(root))
  setRight(root, next)
  return root
}

export const share = (first, second, argument) =>
  pair(
    pair(first, argument),
    pair(second, argument)
  )

export const observe = focus => {
  let current = focus

  while (true) {
    const first = left(current)
    if (first === I) return right(current)
    current = first
  }
}
