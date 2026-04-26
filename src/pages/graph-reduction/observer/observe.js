/**
 * Performs one observation step.
 *
 * @param {unknown} focus
 * @returns {unknown}
 */
export const observe = focus => {
  // Atoms are stable
  if (!Array.isArray(focus)) return focus

  const [first, rest] = focus

  // Pairs with atomic left children are stable
  if (!Array.isArray(first)) return focus

  // Pairs with fixed/empty left collapse to right identity
  if (first === focus || !first.length) return rest

  // Observe the next left child
  const nextFirst = observe(first)
  if (nextFirst !== first) return [nextFirst, rest]  // TBD: Immutability?

  // Observe right if left was stable
  const nextRest = observe(rest)
  if (nextRest !== rest) return [first, nextRest]

  // Both sides stable
  return focus
}
