/**
 * @module collapse/snapshot
 *
 * View-only snapshot for visualization.
 */

/**
 * @param {any} node
 * @returns {any}
 */
const cloneNodeForSnapshot = node =>
  node.kind === 'pair'
    ? { ...node, children: [...node.children]}
    : { ...node }

/**
 * @param {any} node
 * @returns {object[]}
 */
const treeLinksForNode = node =>
  node.kind === 'pair'
    ? [{ id: `t:${node.id}:0`,
         kind: 'child',
         from: node.id,
         to: node.children.leftId,
         index: 0 },
       { id: `t:${node.id}:1`,
         kind: 'child',
         from: node.id,
         to: node.children.rightId,
         index: 1 }]
    : []

/**
 * @param {import('../graph.js').Graph} graph
 * @param {string} rootId
 * @param {{ focusId?: string | null, note?: string }} [meta]
 * @returns {{ rootId: string, focusId: string | null, note: string,
 *             graph: { nodes: any[], edges: any[] } }}
 */
export const snapshotFromGraph = (graph, rootId, meta = {}) => {
  const snapshot = { graph: { nodes: graph.nodes.map(cloneNodeForSnapshot),
                              edges: graph.nodes.flatMap(treeLinksForNode) },
                     rootId,
                     focusId: meta.focusId ?? null,
                     note: meta.note ?? '' }

  console.log('%c5. snapshot:', 'color: chocolate',
              { ...meta, edges: snapshot.graph.edges })
  console.table(snapshot.graph.edges)  // Why are all `to` fields undefined?

  return snapshot
}

