/**
 * @module collapse/graph
 *
 * Persistent node-store substrate for collapse evaluation.
 *
 * This is a deliberately tiny subset of the fuller “pointer machine” substrate
 * in the `basis` project: we only need `pair`, `symbol`, and `empty` to study
 * the collapse rule `(() x) → x` as a local rewrite on a binary tree.
 */

import { createIdGenerator, invariant, replaceNode } from './utils.js'

/**
 * @typedef {object} GraphNode
 * @property {string} id
 * @property {'pair'|'symbol'|'empty'} kind
 * @property {[string, string]} [children] pair children
 * @property {string} [label] symbol label
 */

/**
 * @typedef {{ nodes: GraphNode[] }} Graph
 */

const nextNodeId = createIdGenerator('n')

/**
 * @returns {Graph}
 */
export function createGraph() {
  return { nodes: [] }
}

/**
 * @param {Graph} graph
 * @param {Omit<GraphNode, 'id'> & { id?: string }} node
 * @returns {{ graph: Graph, id: string }}
 */
export function addNode(graph, node) {
  const id = node.id ?? nextNodeId()
  const record = /** @type {GraphNode} */ ({ ...node, id })
  assertValidNode(record)
  return { graph: { ...graph, nodes: [...graph.nodes, record] }, id }
}

/**
 * @param {Graph} graph
 * @param {string} id
 * @returns {GraphNode}
 */
export function getNode(graph, id) {
  const node = graph.nodes.find(n => n.id === id)
  invariant(node, `Unknown node ${id}`)
  return node
}

/**
 * @param {Graph} graph
 * @param {string} id
 * @param {(node: GraphNode) => GraphNode} updater
 * @returns {Graph}
 */
export function updateNode(graph, id, updater) {
  return { ...graph, nodes: replaceNode(graph.nodes, id, updater) }
}

/**
 * @param {any} node
 * @returns {void}
 */
export function assertValidNode(node) {
  invariant(node && typeof node === 'object', 'Node must be an object')
  invariant(typeof node.id === 'string' && node.id.length, 'Node must have id')
  invariant(
    node.kind === 'pair' || node.kind === 'symbol' || node.kind === 'empty',
    `Unknown node kind: ${String(node.kind)}`,
  )

  if (node.kind === 'pair') {
    invariant(
      Array.isArray(node.children) && node.children.length === 2,
      `pair ${node.id} must have 2 children`,
    )
    return
  }
  if (node.kind === 'symbol') {
    invariant(typeof node.label === 'string', `symbol ${node.id} needs label`)
    return
  }
}

