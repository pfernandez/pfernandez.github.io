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

const isEmpty = term => Array.isArray(term) && term.length === 0
const isAtom = term => !Array.isArray(term)

export const collapse = term => {
  // TBD: Distinguish reducible structure from quoted data.
  if (isAtom(term) || isEmpty(term)) return term

  // Preserve the right subtree by reference when the change happens on the left.
  const [left, right] = term

  if (isEmpty(left)) return right

  const nextLeft = collapse(left)

  // If the left branch is stuck, the whole term is stuck for this schedule.
  return nextLeft === left ? term : [nextLeft, right]
}
