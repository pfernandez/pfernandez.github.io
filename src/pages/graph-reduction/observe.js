import { collapse } from './collapse.js'

/**
 * Observe one whole collapse event from the root.
 *
 * @param {*} pair
 * @returns {{ after: *, changed: boolean,
 *             event: { path: string, before: *, after: * } | null }}
 */
export const observe = pair => {
  const tick = (node, path) => {
    const after = collapse(node)
    if (after !== node) {
      return { after, changed: true, event: { path, before: node, after } }
    }

    if (!Array.isArray(node) || node.length !== 2) {
      return { after: node, changed: false, event: null }
    }

    const nextLeft = tick(node[0], `${path}0`)
    return nextLeft.changed
      ? { after: [nextLeft.after, node[1]],
          changed: true,
          event: nextLeft.event }
      : { after: node, changed: false, event: null }
  }

  const ticked = tick(pair, 'root')
  return ticked.changed
    ? { after: ticked.after,
        changed: true,
        event: { path: ticked.event.path, before: pair, after: ticked.after }}
    : { after: pair, changed: false, event: null }
}
