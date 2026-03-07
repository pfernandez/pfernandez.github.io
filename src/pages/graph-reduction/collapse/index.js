/**
 * @module collapse
 *
 * Minimal collapse interpreter entrypoint.
 *
 * This module ties together:
 * - parsing S-expressions into a *binary* pairs AST,
 * - compiling into a tiny node-store graph substrate,
 * - stepping via the single collapse rule `(() x) → x`,
 * - producing snapshots for visualization.
 *
 * This is intentionally small so it can be ported to WASM later as the
 * “bare-metal pointer machine” core, with JS remaining as a DOM/device adapter.
 */

import { parseSexpr } from './sexpr.js'
import { createGraph } from './graph.js'
import { buildGraphFromPairAst } from './compile.js'
import { applyCollapse, findNextCollapse } from './machine.js'
import { serializeGraph } from './serialize.js'
import { snapshotFromGraph } from './snapshot.js'

export {
  parseSexpr,
  createGraph,
  buildGraphFromPairAst,
  findNextCollapse,
  applyCollapse,
  serializeGraph,
  snapshotFromGraph
}

/**
 * Parse and compile a binary pair expression into a graph.
 * @param {string} source
 * @returns {{ graph: import('./graph.js').Graph, rootId: string }}
 */
export function compileSource(source) {
  const ast = parseSexpr(source)
  const compiled = buildGraphFromPairAst(createGraph(), ast)

  console.log('compileSource', { source, ast, compiled })

  return { graph: compiled.graph, rootId: compiled.nodeId }
}

