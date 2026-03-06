/**
 * @module collapse/serialize
 *
 * Convert a collapse graph back into a Lisp-ish binary S-expression string.
 *
 * This is for display/debugging, not for “meaning”.
 */

import { getNode } from './graph.js'

/**
 * @param {import('./graph.js').Graph} graph
 * @param {string} nodeId
 * @returns {string}
 */
const nodeToString = (graph, nodeId) => {
  const node = getNode(graph, nodeId)
  if (node.kind === 'empty') return '()'
  if (node.kind === 'symbol') return String(node.label ?? '#sym')
  const [leftId, rightId] = node.children ?? []
  return `(${nodeToString(graph, leftId)} ${nodeToString(graph, rightId)})`
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @returns {string}
 */
export const serializeGraph = (graph, rootId) => nodeToString(graph, rootId)

