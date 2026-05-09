const isEmpty = pair => !pair.length

/**
 * Performs one observation step.
 *
 * @param {Array | String} focus
 * @returns {Array | String}
 */
export const observe = focus => {
  if (isEmpty(focus)) return focus

  const [left, right] = focus

  if (isEmpty(left)) return right

  return observe(left)
}

