export const I = []
I[0] = I
I[1] = I

export const pair = (first = I, next = I) => {
  return [first, next]
}

/**
 * Performs one observation step.
 *
 * @param {Array} focus
 * @returns {Array} focus
 */
export const observe = focus => {
  const [first, next] = focus

  if (first === I) return next

  return observe(first)
}
