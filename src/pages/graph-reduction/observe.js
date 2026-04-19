const isAtom = node => !Array.isArray(node)
const isEmpty = node => Array.isArray(node) && node.length === 0
const isSelf = (a, b) => a === b


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

  return root
}

