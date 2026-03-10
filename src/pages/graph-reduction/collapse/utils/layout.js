/**
 * @module collapse/layout
 *
 * Deterministic tree layout for AST snapshots.
 */

/**
 * @typedef {import('./ast-types').AtomAst} AtomAst
 * @typedef {0 | 1} PairIndex
 * @typedef {PairIndex[]} CollapsePath
 *
 * @typedef {{
 *   id: string,
 *   kind: string,
 *   label: string,
 *   focus: boolean,
 *   x: number,
 *   y: number
 * }} LayoutNode
 *
 * @typedef {{ from: string, to: string }} LayoutEdge
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
 * @param {CollapsePath} path
 * @returns {string}
 */
const pathId = path => path.length === 0 ? 'root' : `p${path.join('')}`

/**
 * @param {CollapsePath} path
 * @param {CollapsePath | null} focusPath
 * @returns {boolean}
 */
const isFocused = (path, focusPath) =>
  focusPath !== null
  && path.length === focusPath.length
  && path.every((step, index) => step === focusPath[index])

/**
 * @param {AtomAst} ast
 * @param {CollapsePath | null} [focusPath]
 * @returns {{ nodes: LayoutNode[],
 *             edges: LayoutEdge[], width: number, height: number }}
 */
export function layoutSnapshotTree(ast, focusPath = null) {
  /** @type {LayoutNode[]} */
  const nodes = []
  /** @type {LayoutEdge[]} */
  const edges = []
  let leafX = 0
  let maxDepth = 0

  /**
   * @param {AtomAst} node
   * @param {number} depth
   * @param {CollapsePath} path
   * @returns {number}
   */
  const walk = (node, depth, path) => {
    maxDepth = Math.max(maxDepth, depth)

    if (Array.isArray(node) && node.length !== 0 && node.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    const id = pathId(path)
    const focus = isFocused(path, focusPath)

    if (!isPairAst(node)) {
      const x = leafX++
      nodes.push({
        id,
        kind: isEmptyAst(node) ? 'empty' : 'atom',
        label: isEmptyAst(node) ? '()' : String(node),
        focus,
        x,
        y: depth
      })
      return x
    }

    const leftPath = [...path, 0]
    const rightPath = [...path, 1]
    const leftId = pathId(leftPath)
    const rightId = pathId(rightPath)

    edges.push({ from: id, to: leftId }, { from: id, to: rightId })

    const leftX = walk(node[0], depth + 1, leftPath)
    const rightX = walk(node[1], depth + 1, rightPath)
    const x = (leftX + rightX) / 2

    nodes.push({
      id,
      kind: 'pair',
      label: '·',
      focus,
      x,
      y: depth
    })
    return x
  }

  walk(ast, 0, [])

  return {
    nodes,
    edges,
    width: Math.max(1, leafX),
    height: maxDepth + 1
  }
}
