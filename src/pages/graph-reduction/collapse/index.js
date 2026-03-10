/**
 * @module collapse
 *
 * Minimal collapse interpreter.
 *
 * One rule:
 *   (() x) -> x
 *
 * Examples to keep in mind:
 * `((() a) b) -> (a b), (a (() b)) -> (a b)`.
 */

/**
 * @typedef {import('./utils/pair-types').Pair} Pair
 */

/**
 * @param {Pair} pair
 * @returns {pair is []}
 */
const isEmpty = pair => Array.isArray(pair) && pair.length === 0

/**
 * @param {Pair} pair
 * @returns {pair is [Pair, Pair]}
 */
const isPair = pair => Array.isArray(pair) && pair.length === 2

/**
 * One leftmost-outermost collapse step.
 * @param {Pair} pair
 * @returns {Pair | null}
 */
export const collapse = pair => {
  if (!isPair(pair)) return null

  const [left, right] = pair
  if (isEmpty(left)) return right

  const nextLeft = collapse(left)
  if (nextLeft !== null) return [nextLeft, right]

  const nextRight = collapse(right)
  if (nextRight !== null) return [left, nextRight]

  return null
}
