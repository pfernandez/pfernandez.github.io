/**
 * @module collapse/ast
 *
 * Canonical AST used by the collapse interpreter.
 *
 * We intentionally restrict surface S-expressions to a *binary* discipline:
 * every list must be either `()` or a 2-tuple `(a b)`. This keeps the AST
 * isomorphic to a full binary tree / pairs encoding.
 */

import { invariant } from './utils.js'

/**
 * @typedef {string | number | PairAst} AtomAst
 * @typedef {[] | [AtomAst, AtomAst]} PairAst
 */

/**
 * Normalize a parsed S-expression into a binary pair AST.
 * @param {any} expr
 * @returns {AtomAst}
 */
export const toPairAst = expr => {
  if (expr == null) return []
  if (typeof expr === 'string' || typeof expr === 'number') return expr

  invariant(Array.isArray(expr), 'Expression must be an atom or list')
  if (expr.length === 0) return []
  invariant(
    expr.length === 2,
    'Lists must have exactly 2 elements (binary pairs)'
  )
  return [toPairAst(expr[0]), toPairAst(expr[1])]
}

