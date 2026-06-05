import config from './config.lisp.js'

/**
 * Performs one passive observation step.
 *
 * A frame is `[observer, focus]`. Starting at `focus`, observation walks the
 * left spine until it finds a pair whose first slot is exactly `observer`, then
 * returns that pair's second slot. It does not allocate, mutate, or normalize.
 * The optional trace hook reports each value passed to `walk` without changing
 * the returned graph.
 *
 * @param {[any, any]} frame
 * @returns {Array}
 */
export const observe = ([observer, focus]) => {
  const step = node => (
    config.trace?.(node),
    node[0] === observer ? node[1] : step(node[0]))

  return step(focus)
}
