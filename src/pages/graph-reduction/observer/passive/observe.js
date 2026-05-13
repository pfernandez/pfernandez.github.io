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

/**
 * Infers a stable observer witness from pair-shaped history.
 *
 * @param {Array} observer
 * @returns {Array}
 */
export const infer = observer => {
  const [graph, previous] = observer
  return !isEmpty(previous) && previous[0] === graph ? previous : []
}

/**
 * Advances an observer by one pair-local observation.
 *
 * @param {Array} observer
 * @returns {Array}
 */
export const step = observer =>
  [observe(observer[0]), observer]
