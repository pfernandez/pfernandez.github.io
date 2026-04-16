const isPair = node => Array.isArray(node) && node.length === 2
const isEmpty = node => Array.isArray(node) && node.length === 0

const feedArg = (body, arg) => {
  if (typeof body === 'number') return body === 0 ? arg : body - 1
  if (!isPair(body)) return body
  return [feedArg(body[0], arg), feedArg(body[1], arg)]
}

/**
 * Performs only the local observation rule at the current node.
 *
 * A reducible application has the form `[[[], body], arg]`.
 * If no root contraction is available, the original node is returned unchanged.
 *
 * @param {*} root
 * @returns {*}
 */
export const observe = root => {
  if (!isPair(root)) return root

  const [first, rest] = root
  return isPair(first) && isEmpty(first[0]) ? feedArg(first[1], rest) : root
}

/**
 * Performs one leftmost-outermost reduction step.
 *
 * This keeps the local rewrite law (`observe`) separate from the search
 * strategy that walks down the left spine looking for the next redex.
 *
 * @param {*} root
 * @returns {*}
 */
export const step = root => {
  const next = observe(root)
  if (next !== root) return next
  if (!isPair(root)) return root

  const [first, rest] = root
  const reduced = step(first)
  return reduced === first ? root : [reduced, rest]
}
