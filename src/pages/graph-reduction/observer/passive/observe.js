export const I = []
I[0] = I
I[1] = I

/**
 * Performs one observation step.
 *
 * @param {Array} frame
 * @returns {Array} focus
 */
export const observe = ([observer, focus]) => {
  const walk = ([first, next]) => {
    if (first === observer) return next

    return walk(first)
  }

  return walk(focus)
}
