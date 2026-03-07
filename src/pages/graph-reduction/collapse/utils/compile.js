/**
 * @module collapse/compile
 *
 * Compile the binary pair AST into the `collapse/graph` substrate.
 */

import { addNode } from '../graph.js'

/**
 * @typedef {import('./ast-types').AtomAst} AtomAst
 * @typedef {import('../graph.js').Graph} Graph
 */

/**
 * @param {Graph} graph
 * @returns {{ graph: Graph, nodeId: string }}
 */
function compileEmpty(graph) {
  const added = addNode(graph, { kind: 'empty' })
  return { graph: added.graph, nodeId: added.id }
}

/**
 * @param {Graph} graph
 * @param {string} label
 * @returns {{ graph: Graph, nodeId: string }}
 */
function compileSymbol(graph, label) {
  const added = addNode(graph, { kind: 'symbol', label })
  return { graph: added.graph, nodeId: added.id }
}

/**
 * @param {Graph} graph
 * @param {string} leftId
 * @param {string} rightId
 * @returns {{ graph: Graph, nodeId: string }}
 */
function compilePair(graph, leftId, rightId) {
  const added = addNode(graph, { kind: 'pair', children: [leftId, rightId]})
  return { graph: added.graph, nodeId: added.id }
}

/**
 * Build a graph from a binary pair AST.
 * @param {Graph} graph
 * @param {AtomAst} ast
 * @returns {{ graph: Graph, nodeId: string }}
 */
export function buildGraphFromPairAst(graph, ast) {
  if (Array.isArray(ast)) {
    if (ast.length === 0) return compileEmpty(graph)
    const left = buildGraphFromPairAst(graph, ast[0])
    const right = buildGraphFromPairAst(left.graph, ast[1])
    return compilePair(right.graph, left.nodeId, right.nodeId)
  }
  return compileSymbol(graph, String(ast))
}
