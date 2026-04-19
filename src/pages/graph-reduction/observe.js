const isAtom = node => !Array.isArray(node)
const isEmpty = node => Array.isArray(node) && node.length === 0
const isSelf = (a, b) => a === b
const isPair = node => Array.isArray(node) && node.length === 2


/**
 * @param {*} root
 * @returns {*} pair
 */
export const observe = root => {
  if (isAtom(root)) return root

  const [first, rest] = root

  if (isSelf(first, root)) return rest
  if (isEmpty(first)) return rest

  const next = observe(first)

  if (!isSelf(next, first)) return [next, rest]
  if (!isAtom(first)) {
    const nextRest = observe(rest)
    if (!isSelf(nextRest, rest)) return [first, nextRest]
  }

  if (isPair(first) && isPair(rest) && isSelf(first[1], rest[1])) {
    const nextRest = observe(first[1])
    if (!isSelf(nextRest, first[1])) {
      return [[first[0], nextRest], [rest[0], nextRest]]
    }
  }

  return root
}
