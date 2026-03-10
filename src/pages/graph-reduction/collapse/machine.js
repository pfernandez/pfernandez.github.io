/**
 * @module collapse/machine
 *
 * Collapse machine (single visible step)
 *
 * Implements the single local reduction rule:
 *
 *   (() x) → x
 *
 * Examples to keep in mind:
 * `((() a) b) -> (a b), (a (() b)) -> (a b)`.
 *
 * The reducer walks the term leftmost-outermost and returns both the next term
 * and the path of the collapsed pair, so the UI can highlight the next step
 * without translating through an intermediate graph.
 */

/**
 * @typedef {import('./utils/ast-types').AtomAst} AtomAst
 * @typedef {0 | 1} PairIndex
 * @typedef {PairIndex[]} CollapsePath
 * @typedef {{
 *   ast: AtomAst,
 *   changed: boolean,
 *   focusPath: CollapsePath | null
 * }} CollapseStep
 */

/**
 * @param {AtomAst} ast
 * @returns {ast is []}
 */
const isEmptyAst = ast => Array.isArray(ast) && ast.length === 0

/**
 * @param {AtomAst} ast
 * @returns {ast is [AtomAst, AtomAst]}
 */
const isPairAst = ast => Array.isArray(ast) && ast.length === 2

/**
 * @param {AtomAst} ast
 * @param {CollapsePath} path
 * @returns {CollapseStep}
 */
const step = (ast, path) => {
  if (!isPairAst(ast)) return { ast, changed: false, focusPath: null }

  const [left, right] = ast

  if (isEmptyAst(left)) {
    return { ast: right, changed: true, focusPath: path }
  }

  const nextLeft = step(left, [...path, 0])
  if (nextLeft.changed) {
    return {
      ast: [nextLeft.ast, right],
      changed: true,
      focusPath: nextLeft.focusPath
    }
  }

  const nextRight = step(right, [...path, 1])
  if (nextRight.changed) {
    return {
      ast: [left, nextRight.ast],
      changed: true,
      focusPath: nextRight.focusPath
    }
  }

  return { ast, changed: false, focusPath: null }
}

/**
 * Perform one leftmost-outermost collapse step.
 * @param {AtomAst} ast
 * @returns {CollapseStep}
 */
export const collapseOnce = ast => step(ast, [])
