/**
 * @module collapse/layout
 *
 * Deterministic tree layout for pair snapshots.
 */

/**
 * @typedef {import('./pair-types').Pair} Pair
 * @typedef {0 | 1} Side
 * @typedef {Side[]} Path
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
 * @param {Pair} pair
 * @returns {pair is []}
 */
const isEmpty = pair => Array.isArray(pair) && pair.length === 0

/**
 * @param {Pair} pair
 * @returns {pair is [Pair, Pair]}
 */
const isPair = pair => Array.isArray(pair) && pair.length === 2

/**
 * @param {Path} path
 * @returns {string}
 */
const pathId = path => path.length === 0 ? 'root' : `p${path.join('')}`

/**
 * @param {Path} path
 * @param {Path | null} focus
 * @returns {boolean}
 */
const isFocused = (path, focus) =>
  focus !== null
  && path.length === focus.length
  && path.every((step, index) => step === focus[index])

/**
 * @param {Pair} pair
 * @param {Path | null} [focus]
 * @returns {{ nodes: LayoutNode[],
 *             edges: LayoutEdge[], width: number, height: number }}
 */
export function layout(pair, focus = null) {
  /** @type {LayoutNode[]} */
  const nodes = []
  /** @type {LayoutEdge[]} */
  const edges = []
  let leafX = 0
  let maxDepth = 0

  /**
   * @param {Pair} pair
   * @param {number} depth
   * @param {Path} path
   * @returns {number}
   */
  const walk = (pair, depth, path) => {
    maxDepth = Math.max(maxDepth, depth)

    if (Array.isArray(pair) && pair.length !== 0 && pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    const id = pathId(path)
    const focused = isFocused(path, focus)

    if (!isPair(pair)) {
      const x = leafX++
      nodes.push({
        id,
        kind: isEmpty(pair) ? 'empty' : 'atom',
        label: isEmpty(pair) ? '()' : String(pair),
        focus: focused,
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

    const leftX = walk(pair[0], depth + 1, leftPath)
    const rightX = walk(pair[1], depth + 1, rightPath)
    const x = (leftX + rightX) / 2

    nodes.push({
      id,
      kind: 'pair',
      label: '·',
      focus: focused,
      x,
      y: depth
    })
    return x
  }

  walk(pair, 0, [])

  return {
    nodes,
    edges,
    width: Math.max(1, leafX),
    height: maxDepth + 1
  }
}
