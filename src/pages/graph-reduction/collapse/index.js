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
  if (!isPair(pair)) return null

  const [left, right] = pair
  if (isEmpty(left)) return right

  const nextLeft = collapse(left)
  if (nextLeft !== null) return [nextLeft, right]

  const nextRight = collapse(right)
  if (nextRight !== null) return [left, nextRight]

  return null
}
