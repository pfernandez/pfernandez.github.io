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

const isEmpty = pair => Array.isArray(pair) && pair.length === 0

const isPair = pair => Array.isArray(pair) && pair.length === 2

// One leftmost-outermost collapse step.
export const collapse = pair => {
  if (!isPair(pair)) return pair

  const [left, right] = pair
  if (isEmpty(left)) return right

  const nextLeft = collapse(left)
  if (nextLeft !== left) return [nextLeft, right]

  const nextRight = collapse(right)
  if (nextRight !== right) return [left, nextRight]

  return pair
}
