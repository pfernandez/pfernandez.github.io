/**
 * @module collapse/snapshot
 *
 * View-only snapshot for visualization.
 */

/**
 * @param {any} node
 * @returns {any}
 */
function cloneNodeForSnapshot(node) {
  if (node.kind !== 'pair') return { ...node }
  return { ...node, children: [...node.children] }
}

/**
 * @param {any} node
 * @returns {object[]}
 */
function treeLinksForNode(node) {
  if (node.kind !== 'pair') return []
  const [leftId, rightId] = node.children
  return [
    { id: `t:${node.id}:0`, kind: 'child', from: node.id, to: leftId, index: 0 },
    { id: `t:${node.id}:1`, kind: 'child', from: node.id, to: rightId, index: 1 },
  ]
}

/**
 * @param {import('./graph.js').Graph} graph
 * @param {string} rootId
 * @param {{ focusId?: string | null, note?: string }} [meta]
 * @returns {{ rootId: string, focusId: string | null, note: string, graph: { nodes: any[], edges: any[] } }}
 */
export function snapshotFromGraph(graph, rootId, meta = {}) {
  const nodes = graph.nodes.map(cloneNodeForSnapshot)
  const edges = nodes.flatMap(treeLinksForNode)
  return {
    graph: { nodes, edges },
    rootId,
    focusId: meta.focusId ?? null,
    note: meta.note ?? '',
  }
}

