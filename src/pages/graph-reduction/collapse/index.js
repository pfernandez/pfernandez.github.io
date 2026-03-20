/**
 * @module collapse
 *
 * Minimal collapse interpreter.
 *
 * One rule:
 *   (() x) -> x
 */

const isEmpty = pair => Array.isArray(pair) && pair.length === 0
const isVar = pair => !Array.isArray(pair)

export const collapse = pair => {
  // TBD: Return quoted patterns
  if (isVar(pair)) return pair

  // Preserve references for structural sharing
  const [left, right] = pair

  // "Collapse" is identity as fall-through: (() x) -> x
  if (isEmpty(left)) return right

  // Reduce the left pair. If unchanged ("stuck"), return it.
  const nextLeft = collapse(left)
  return nextLeft === left ? pair : [nextLeft, right]

  /**
   * We can reduce right, but is it causally justified for the following
   * bijection?
   *
   * | Dyck path | S-expression |
   * |-----------|--------------|
   * | ()        | (() ())      |
   *
   * Both are Catalan pairs with a send-return causal order. The Dyck paths
   * (()) and ()() are "send-send-return-return" and "send-return-send-return"
   * respectively, the stack traces of the equivalent S-expressions. The
   * half-line (( is a causal path in probability space, and "collapse" is
   * triggered upon observation, as seen in the double-slit experiment.
   */
  // if (nextLeft !== left) return [nextLeft, right]
  // const nextRight = collapse(right)
  // if (nextRight !== right) return [left, nextRight]
  // return pair
}

