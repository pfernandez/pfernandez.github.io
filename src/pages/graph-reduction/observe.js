/**
 * Observe one whole collapse event from the root.
 *
 * @param {*} pair
 * @returns {{ after: *, changed: boolean,
 *             event: { path: string, before: *, after: * } | null }}
 */
export const observe = pair => {
  const tick = (node, path) => {

    // If the left child is empty, collapse to identity.
    // TBD: Everything should be pairs, but for now we return atoms.
    const after = Array.isArray(node)
      && node.length === 2
      && Array.isArray(node[0])
      && node[0].length === 0 ? node[1] : node

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
        event: { path: ticked.event.path, before: pair, after: ticked.after } }
    : { after: pair, changed: false, event: null }
}
