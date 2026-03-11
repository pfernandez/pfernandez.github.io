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

const isLeaf = pair => !Array.isArray(pair)

// One leftmost-outermost collapse step.
// For now, "leftmost" is only the reducer's search order. It does not yet mean
// that the left branch is the present and the right branch is still unrealized.
// If we later give that asymmetry causal meaning, this will need an explicit
// notion of focus or frontier, not just a tree walk.
export const collapse = pair => {
  if (isLeaf(pair) || isEmpty(pair)) return pair
  if (pair.length !== 2) throw new Error('Lists must be empty or pairs')

  const [left, right] = pair
  if (isEmpty(left)) return right

  const nextLeft = collapse(left)
  if (nextLeft !== left) return [nextLeft, right]

  const nextRight = collapse(right)
  if (nextRight !== right) return [left, nextRight]

  return pair
}
