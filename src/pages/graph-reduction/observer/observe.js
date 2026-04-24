/**
 * One observer step for the pair graph.
 *
 * The machine sees only binary array pairs, the empty array, atoms, and
 * reference identity. Non-pairs and malformed arrays are stable boundaries;
 * malformed arrays should not be produced by the source compiler. A fixed
 * pair `p = [p, value]` fires to `value`, and a pair with `()` on the left
 * collapses to its right side.
 *
 * Focus is left before right, but atom-headed pairs are observation
 * boundaries: their right side is not forced. A legal observer step is
 * pair-local and Markov: it depends only on the current graph, fires one
 * focused boundary event, preserves off-path object identity, and treats
 * duplicated structure as shared only when reference identity already says it
 * is shared.
 */

/**
 * A binary graph vertex with left and right slots.
 *
 * @typedef {Array<unknown>} Pair
 */

/**
 * Atoms are opaque terminals: observation never enters them.
 *
 * @param {unknown} node
 * @returns {boolean}
 */
const isAtom = node => !Array.isArray(node)

/**
 * `()` is stable alone and annihilates from the left side of a pair.
 *
 * @param {unknown} node
 * @returns {boolean}
 */
const isEmpty = node => Array.isArray(node) && node.length === 0

/**
 * A pair is the only graph vertex with two observable directions.
 *
 * @param {unknown} node
 * @returns {node is Pair}
 */
const isPair = node => Array.isArray(node) && node.length === 2

/**
 * A fixed pair points left to itself and exposes its right payload.
 *
 * @param {Pair} pair
 * @returns {boolean}
 */
const isFixed = pair => pair[0] === pair

/**
 * An empty-headed pair collapses to its sibling.
 *
 * @param {Pair} pair
 * @returns {boolean}
 */
const hasEmptyHead = pair => isEmpty(pair[0])

/**
 * An atom-headed pair hides the right side from observer focus.
 *
 * @param {Pair} pair
 * @returns {boolean}
 */
const hasAtomHead = pair => isAtom(pair[0])

/**
 * Identity change is the observable sign that a child step fired.
 *
 * @param {unknown} next
 * @param {unknown} previous
 * @returns {boolean}
 */
const changed = (next, previous) => next !== previous

/**
 * Performs one immutable observation step.
 *
 * If a rewrite fires below the root, the changed path is returned as fresh
 * array wrappers so callers can retain previous snapshots. Unchanged branches
 * and shared continuations keep their object identities.
 *
 * @param {unknown} root
 * @returns {unknown}
 */
export const observe = root => {
  if (!isPair(root)) return root

  const [first, rest] = root

  if (isFixed(root)) return rest
  if (hasEmptyHead(root)) return rest
  if (hasAtomHead(root)) return root

  const nextFirst = observe(first)
  if (changed(nextFirst, first)) return [nextFirst, rest]

  const nextRest = observe(rest)
  if (changed(nextRest, rest)) return [first, nextRest]

  return root
}
