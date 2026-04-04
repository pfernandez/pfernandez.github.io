/**
 * @module collapse
 *
 * Local collapse law.
 *
 * One rule:
 *   (() x) -> x
 *
 * `collapse` is local: it only discharges `(() x)` to `x`.
 */

/**
 * Collapse one local pair.
 *
 * @param {*} pair
 * @returns {*}
 */
export const collapse = pair =>
  Array.isArray(pair)
  && pair.length === 2
  && Array.isArray(pair[0])
  && pair[0].length === 0
    ? pair[1]
    : pair
