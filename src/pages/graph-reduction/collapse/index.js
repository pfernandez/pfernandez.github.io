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
 * @typedef {0 | 1} Side
 * @typedef {Side[]} Path
 * @typedef {{
 *   pair: Pair,
 *   changed: boolean,
 *   path: Path | null
 * }} CollapseResult
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
 * @param {Path} [path]
 * @returns {CollapseResult}
 */
export const collapse = (pair, path = []) => {
  if (!isPair(pair)) return { pair, changed: false, path: null }

  const [left, right] = pair
  if (isEmpty(left)) return { pair: right, changed: true, path }

  const nextLeft = collapse(left, [...path, 0])
  if (nextLeft.changed) {
    return { pair: [nextLeft.pair, right], changed: true, path: nextLeft.path }
  }

  const nextRight = collapse(right, [...path, 1])
  if (nextRight.changed) {
    return { pair: [left, nextRight.pair], changed: true, path: nextRight.path }
  }

  return { pair, changed: false, path: null }
}
