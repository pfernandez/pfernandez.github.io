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
import { toPairAst } from './ast.js'
import { createGraph } from './graph.js'
import { buildGraphFromPairAst } from './compile.js'
import { findNextCollapse, applyCollapse } from './machine.js'
import { serializeGraph } from './serialize.js'
import { snapshotFromGraph } from './snapshot.js'

export {
  parseSexpr,
  toPairAst,
  createGraph,
  buildGraphFromPairAst,
  findNextCollapse,
  applyCollapse,
  serializeGraph,
  snapshotFromGraph,
}

/**
 * Parse and compile a binary pair expression into a graph.
 * @param {string} source
 * @returns {{ graph: import('./graph.js').Graph, rootId: string }}
 */
export function compileSource(source) {
  const parsed = parseSexpr(source)
  const ast = toPairAst(parsed)
  const compiled = buildGraphFromPairAst(createGraph(), ast)
  return { graph: compiled.graph, rootId: compiled.nodeId }
}

