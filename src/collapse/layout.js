/**
 * @module collapse/layout
 *
 * Deterministic tree layout for snapshots.
 *
 * We keep this “obviously correct” rather than clever: a simple inorder leaf
 * layout makes it easy to watch collapse events without bringing in a graph
 * library.
 */

import { invariant } from './utils.js'

/**
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   label?: string,
 *   children?: [string, string]
 * }} SnapshotNode
 *
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   from: string,
 *   to: string,
 *   index: 0 | 1
 * }} SnapshotEdge
 */

/**
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   label: string,
 *   x: number,
 *   y: number
 * }} LayoutNode
 *
 * @typedef {{ from: string, to: string }} LayoutEdge
 */

/**
 * @param {{ nodes: SnapshotNode[], edges: SnapshotEdge[] }} snapshotGraph
 * @param {string} rootId
 * @returns {{ nodes: LayoutNode[], edges: LayoutEdge[], width: number, height: number }}
 */
export function layoutSnapshotTree(snapshotGraph, rootId) {
  const byId = new Map(snapshotGraph.nodes.map(n => [n.id, n]))
  const childrenOf = nodeId => {
    const node = byId.get(nodeId)
    if (!node) return null
    if (node.kind !== 'pair') return null
    const kids = node.children ?? []
    invariant(kids.length === 2, 'pair must have 2 children')
    return /** @type {[string, string]} */ ([kids[0], kids[1]])
  }

  const nodes = []
  const edges = []
  let leafX = 0
  let maxDepth = 0

  const walk = (nodeId, depth) => {
    maxDepth = Math.max(maxDepth, depth)
    const node = byId.get(nodeId)
    invariant(node, `Unknown node ${nodeId}`)

    const kids = childrenOf(nodeId)
    if (!kids) {
      const x = leafX++
      nodes.push({
        id: nodeId,
        kind: node.kind,
        label: node.kind === 'empty' ? '()' : String(node.label ?? ''),
        x,
        y: depth,
      })
      return x
    }

    const [l, r] = kids
    edges.push({ from: nodeId, to: l })
    edges.push({ from: nodeId, to: r })

    const leftX = walk(l, depth + 1)
    const rightX = walk(r, depth + 1)
    const x = (leftX + rightX) / 2
    nodes.push({
      id: nodeId,
      kind: node.kind,
      label: '·',
      x,
      y: depth,
    })
    return x
  }

  walk(rootId, 0)

  return {
    nodes,
    edges,
    width: Math.max(1, leafX),
    height: maxDepth + 1,
  }
}

