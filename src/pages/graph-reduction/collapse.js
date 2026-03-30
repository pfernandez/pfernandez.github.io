/**
 * @module collapse
 *
 * Minimal collapse interpreter.
 *
 * One rule:
 *   (() x) -> x
 *
 * `collapse` performs a single step using a leftmost-outermost schedule.
 * Only the left branch is searched. The right branch is left untouched until
 * a collapse exposes it.
 */

const isEmpty = pair => Array.isArray(pair) && pair.length === 0
const isPair = pair => Array.isArray(pair) && pair.length === 2

/**
 * Collapse one reachable redex under the leftmost-outermost schedule.
 *
 * If no collapse is reachable, the input pair is returned unchanged.
 *
 * @param {*} pair
 * @returns {*}
 */
export const collapse = function collapse(pair) {
  // TBD: Distinguish reducible structure from quoted data.
  if (!isPair(pair)) return pair

  const [left, right] = pair
  if (isEmpty(left)) {
    return right
  }

  const nextLeft = collapse(left)
  return nextLeft === left ? pair : [nextLeft, right]
}
