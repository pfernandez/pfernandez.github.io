/**
 * Performs one observation step.
 *
 * @param {unknown} focus
 * @returns {unknown}
 */
export const observe = focus => {
  if (!Array.isArray(focus) || focus.length === 0) return focus

  const [first, rest] = focus

  if (first === focus || (Array.isArray(first) && first.length === 0)) return rest

  const nextFirst = observe(first)
  if (nextFirst !== first) return [nextFirst, rest]

  const nextRest = observe(rest)
  if (nextRest !== rest) return [first, nextRest]

  return focus
}
