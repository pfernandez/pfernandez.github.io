/**
 * @module collapse/graph
 *
 * Persistent node-store substrate for collapse evaluation.
 *
 * This is a deliberately tiny subset of the fuller “pointer machine” substrate
 * in the `basis` project: we only need `pair`, `symbol`, and `empty` to study
 * the collapse rule `(() x) → x` as a local rewrite on a binary tree.
 */

import { createIdGenerator, invariant, replaceNode } from './utils'

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
export const createGraph = () => ({ nodes: []})

/**
 * @param {Graph} graph
 * @param {Omit<GraphNode, 'id'> & { id?: string }} node
 * @returns {{ graph: Graph, id: string }}
 */
export const addNode = (graph, node) => {
  const id = node.id ?? nextNodeId()
  const record = /** @type {GraphNode} */ ({ ...node, id })
  assertValidNode(record)
  return { graph: { ...graph, nodes: [...graph.nodes, record]}, id }
}

/**
 * @param {Graph} graph
 * @param {string} id
 * @returns {GraphNode}
 */
export const getNode = (graph, id) => {
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
export const updateNode = (graph, id, updater) =>
  ({ ...graph, nodes: replaceNode(graph.nodes, id, updater) })

/**
 * @param {any} node
 * @returns {void}
 */
export const assertValidNode = node => {
  invariant(node && typeof node === 'object', 'Node must be an object')
  invariant(typeof node.id === 'string' && node.id.length, 'Node must have id')
  invariant(
    node.kind === 'pair' || node.kind === 'symbol' || node.kind === 'empty',
    `Unknown node kind: ${String(node.kind)}`
  )
  node.kind === 'pair'
    && invariant(Array.isArray(node.children) && node.children.length === 2,
                 `pair ${node.id} must have 2 children`)
  node.kind === 'symbol'
  && invariant(typeof node.label === 'string', `symbol ${node.id} needs label`)
}

