const isPair = node => Array.isArray(node) && node.length === 2
const isEmpty = node => Array.isArray(node) && node.length === 0
const feedArg = (body, arg) => {
  if (typeof body === 'number') return body === 0 ? arg : body - 1
  if (!isPair(body)) return body
  return [feedArg(body[0], arg), feedArg(body[1], arg)]
}

/**
 * @param {*} root
 * @returns {*} pair
 */
export const observe = root => {
  if (!isPair(root)) return root

  const [first, rest] = root

  if (isPair(first) && isEmpty(first[0])) return feedArg(first[1], rest)

  const next = observe(first)
  if (next === first) return root

  return [next, rest]
}
