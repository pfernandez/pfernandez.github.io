const isEmpty = pair => !pair.length

/**
 * Performs one observation step.
 *
 * @param {Array} focus
 * @returns {Array} focus
 */
export const observe = focus => {
  if (isEmpty(focus)) return focus

  const [first, next] = focus

  if (isEmpty(first)) return next

  return observe(first)
}

