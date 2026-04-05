
/**
 * Observe one whole collapse event from the root.
 *
 * @param {*} event
 * @returns {*} pair
 */
export const observe = event => {
  const resolve = (pair = event) => {
    // Atom
    if (!(Array.isArray(pair) && pair.length)) return pair

    const [first, rest] = pair

    // Empty first child
    if (!first.length) return rest

    const next = resolve(first)

    // Reduced fully
    if (next === first) return pair

    return next
  }

  return resolve(event)
}

