/**
 * @param {*} root
 * @returns {*} pair
 */
export const observe = root => {
  // Atom
  if (!Array.isArray(root)) return root

  const [first, rest] = root

  // Empty left
  if (Array.isArray(first) && !first.length) return rest

  const next = observe(first)

  // Normal form
  if (next === first) return root

  // Next focus
  return next
}
