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

/**
 * Collapse one reachable redex under the leftmost-outermost schedule.
 *
 * If no collapse is reachable, the input pair is returned unchanged.
 *
 * If `emit` is provided, it is called once with:
 * `{ path, before, after }` where `path` is a "root..." string pointing at the
 * reduced pair within the original input.
 *
 * @param {*} pair
 * @param {null | ((detail: { path: string, before: *, after: * }) => void)}
 *                emit
 * @returns {*}
 */
export const collapse = (pair, emit = null) => {
  // TBD: Distinguish reducible structure from quoted data.
  const step = (node, path) => {
    if (!Array.isArray(node) || node.length !== 2) {
      return { node, changed: false }
    }

    const [left, right] = node
    if (Array.isArray(left) && left.length === 0) {
      emit?.({ path, before: node, after: right })
      return { node: right, changed: true }
    }

    const nextLeft = step(left, `${path}0`)
    return nextLeft.changed
      ? { node: [nextLeft.node, right], changed: true }
      : { node, changed: false }
  }

  return step(pair, 'root').node
}
