import { collapse } from '../index.js'

/**
 * Observe one whole collapse event from the root.
 *
 * This is notebook/UI plumbing, not kernel semantics.
 *
 * @param {*} pair
 * @returns {{ after: *, changed: boolean, event: { path: string, before: *, after: * } | null }}
 */
export const observe = pair => {
  let localEvent = null
  const after = collapse(pair, event => {
    localEvent = event
  })

  return localEvent === null
    ? { after, changed: false, event: null }
    : { after,
        changed: true,
        event: { path: localEvent.path, before: pair, after } }
}
