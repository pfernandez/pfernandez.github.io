/**
 * The default JavaScript root pair.
 *
 * `I` is a fixed point: both slots point back to itself. The observer does not
 * import or depend on this root; callers pass the observer they want in the
 * frame. This exported instance is a convenient root for tests and hand-built
 * motifs.
 *
 * @type {Array}
 */
export const I = []
I[0] = I
I[1] = I

/**
 * Performs one passive observation step.
 *
 * A frame is `[observer, focus]`. Starting at `focus`, observation walks the
 * left spine until it finds a pair whose first slot is exactly `observer`, then
 * returns that pair's second slot. It does not allocate, mutate, normalize, or
 * consult global state.
 *
 * @param {[Array, Array]} frame
 * @returns {Array}
 */
export const observe = ([observer, focus]) => {
  const walk = ([first, next]) => {
    if (first === observer) return next

    return walk(first)
  }

  return walk(focus)
}
