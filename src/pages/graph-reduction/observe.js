const isPair = node => Array.isArray(node) && node.length === 2
const isEmpty = node => Array.isArray(node) && node.length === 0

/**
 * @param {*} root
 * @returns {*} pair
 */
export const observe = root => {
  if (!isPair(root)) return root

  const [first, rest] = root

  if (isPair(first) && isEmpty(first[0])) return first[1]

  const next = observe(first)
  if (next === first) return root

  return [next, rest]
}
