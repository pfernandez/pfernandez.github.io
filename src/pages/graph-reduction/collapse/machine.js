/**
 * @module collapse/machine
 *
 * Collapse machine (local rewrite)
 *
 * Implements the single local reduction rule:
 *
 *   (() x) → x
 *
 * Interpreting binary pairs as application, this is “empty is identity” under a
 * purely structural, leftmost-outermost schedule.
 *
 * This module is intentionally tiny, so it can serve as a seed for a future
 * WASM “bare metal” pointer machine.
 */

import { getNode } from './graph.js'
import { invariant } from './utils'

/**
 * @typedef {{ kind: 'pair', parentId: string, index: 0 | 1 }} PairFrame
 * @typedef {{ nodeId: string, replacementId: string, path: PairFrame[] }}
 *          CollapseEvent
 */

/**
 * @param {any} node
 * @returns {node is { kind: 'pair', children: [string, string] }}
 */
const isPairNode = node =>
  node?.kind === 'pair'
  && Array.isArray(node.children)
  && node.children.length === 2
  && typeof node.children[0] === 'string'
  && typeof node.children[1] === 'string'

/**
 * Find the next collapse redex using a leftmost-outermost traversal.
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @returns {CollapseEvent | null}
 */
export const findNextCollapse = (graph, rootId) => {
  /** @type {{ nodeId: string, path: PairFrame[] }[]} */
  const stack = [{ nodeId: rootId, path: []}]

  while (stack.length) {
    const item = stack.pop()
    if (!item) break

    const node = getNode(graph, item.nodeId)
    if (!isPairNode(node)) continue

    const [leftId, rightId] = node.children
    const left = getNode(graph, leftId)

    // If the left child is empty, the pair will collapse, leaving the right
    // child in its place.
    if (left.kind === 'empty') {
      const nextCollapse =
        { nodeId: item.nodeId, replacementId: rightId, path: item.path }

      console.log('%c4. next collapse:', 'color: darkorange',
                  { ...nextCollapse, path: JSON.stringify(nextCollapse.path) })

      return nextCollapse
    }

    // Pre-order: examine left child before right child.
    stack.push({
      nodeId: rightId,
      path: [...item.path, { kind: 'pair', parentId: item.nodeId, index: 1 }]
    })
    stack.push({
      nodeId: leftId,
      path: [...item.path, { kind: 'pair', parentId: item.nodeId, index: 0 }]
    })
  }

  return null
}

/**
 * Apply a collapse event.
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {CollapseEvent} event
 * @returns {{ graph: import('./graph.js').Graph, rootId: string }}
 */
export const applyCollapse = (graph, rootId, event) => {
  invariant(event && typeof event === 'object', 'applyCollapse requires event')

  // Replace node at event path
  const { path, replacementId } = event
  const frame = path[path.length - 1]

  //   const collapsed = path.length
  //     ? { graph: { ...graph,
  //                  nodes: graph.nodes.map(node =>
  //                    node.id === frame.parentId
  //                      ? { ...node, children: [replacementId, node.children[1]]}
  //                      : node) },
  //         rootId }
  //     : { graph, rootId: replacementId }

  const updateNode = updater =>
    graph.nodes.map(node => {
      if(node.id === frame.parentId) {
        invariant(isPairNode(node), 'collapse requires a pair node')
        return updater(node)
      }
      return node
    })

  const collapsed = path.length ? {
    graph: { ...graph,
             nodes: updateNode(node =>
               ({ ...node, children: [replacementId, node.children[1]]})) },
    rootId
  } : { graph, rootId: replacementId }


  console.log(
    '%c6. applyCollapse', 'color: brown',
    { ...event, path: JSON.stringify(event.path),
      diff: JSON.stringify(Object.fromEntries(
        Object.entries(collapsed.graph.nodes).filter(
          ([k, v]) => graph.nodes[k] !== v))) })

  return collapsed
}

