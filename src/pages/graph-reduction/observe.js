/**
 * Observer semantics checkpoint.
 *
 * Motifs are built from ordinary array pairs and reference identity. A closure
 * can be wired as a fixed point with `p[0] = p` and `p[1] = value`; shared
 * references are causal links, not duplicated tree shape. The S motif in the
 * tests uses three such closures and shares the third continuation through
 * both branches.
 *
 * Computation requires identity, a null boundary, a local firing pattern, and
 * a focus rule. The choices below are observer policy: `[self, value]` fires
 * to `value`, focus moves left before right, and shared continuations collapse
 * through every branch that sees the same causal object. A sequential observer
 * could expose one occurrence at a time instead.
 *
 * `isAtom` belongs here because atom-ness is an observation boundary. Future
 * engines can replace placeholder atoms with an external pattern protocol
 * while keeping the pair motifs pure. This dashboard observer returns snapshot
 * time rather than mutating pairs in place; an in-place WASM engine can make
 * the opposite choice at the rewrite sites noted below.
 */
const isAtom = node => !Array.isArray(node)
const isEmpty = node => Array.isArray(node) && node.length === 0
const isSelf = (a, b) => a === b
const isPair = node => Array.isArray(node) && node.length === 2
const sharesContinuation = (first, rest) =>
  isPair(first) && isPair(rest) && isSelf(first[1], rest[1])


/**
 * @param {*} root
 * @returns {*} pair
 */
export const observe = root => {
  if (isAtom(root)) return root

  const [first, rest] = root

  if (isSelf(first, root)) return rest
  if (isEmpty(first)) return rest

  const next = observe(first)

  // Observer time is snapshot time; an in-place engine would instead:
  // if (!isSelf(next, first)) {
  //   root[0] = next
  //   return root
  // }
  if (!isSelf(next, first)) return [next, rest]
  if (!isAtom(first)) {
    const nextRest = observe(rest)
    // if (!isSelf(nextRest, rest)) {
    //   root[1] = nextRest
    //   return root
    // }
    if (!isSelf(nextRest, rest)) return [first, nextRest]
  }

  if (sharesContinuation(first, rest)) {
    const nextRest = observe(first[1])
    if (!isSelf(nextRest, first[1])) {
      // A shared continuation is one causal object seen from both branches.
      // Sequential focus would instead return [[first[0], nextRest], rest].
      return [[first[0], nextRest], [rest[0], nextRest]]
    }
  }

  return root
}
