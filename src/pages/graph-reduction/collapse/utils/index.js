/**
 * @module collapse/utils
 *
 * Helpers for the collapse interpreter.
 */

import { createGraph } from '../graph'
import { buildGraphFromPairAst } from './compile'
import { layoutSnapshotTree } from './layout'
import { parseSexpr, serializeGraph } from './sexpr'

export {
  parseSexpr,
  buildGraphFromPairAst,
  serializeGraph,
  layoutSnapshotTree
}

/**
 * Ensure a condition holds, otherwise throw with a message.
 * @param {unknown} condition
 * @param {string} message
 * @returns {asserts condition}
 */
export const invariant = (condition, message) => {
  if (!condition) throw new Error(message)
}

/**
 * Create a simple incremental ID generator.
 * @param {string} prefix
 * @returns {() => string}
 */
export const createIdGenerator = (prefix = 'n') => {
  let counter = 0
  return () => `${prefix}${counter++}`
}

/**
 * Parse and compile a binary pair expression into a graph.
 * @param {string} source
 * @returns {{ graph: import('../graph.js').Graph, rootId: string }}
 */
export function compileSource(source) {
  const ast = parseSexpr(source)

  console.log('%c2. ast:', 'color: yellow;', JSON.stringify(ast))

  const compiled = buildGraphFromPairAst(createGraph(), ast)

  console.log('%c3. nodes:', 'color: orange;')
  console.table(compiled.graph.nodes.map(node => ({
    ...node,
    id: node.id === compiled.nodeId ? `${node.id} (root)` : node.id,
    children: node.children ? node.children.join(', ') : ''
  })))

  return { graph: compiled.graph, rootId: compiled.nodeId }
}

