/**
 * @module layout
 *
 * Deterministic tree layout for pair snapshots.
 */

const isEmpty = pair => Array.isArray(pair) && pair.length === 0
const isLeaf = pair => !Array.isArray(pair)
const isPair = pair => Array.isArray(pair) && pair.length === 2

/**
 * A positioned layout node.
 *
 * @typedef {{
 *   id: string,
 *   kind: 'leaf' | 'empty' | 'pair',
 *   label: string,
 *   x: number,
 *   y: number
 * }} LayoutNode
 */

/**
 * A directed edge from parent id to child id.
 *
 * @typedef {{ from: string, to: string }} LayoutEdge
 */

/**
 * Deterministically lays out a binary S-expression tree for rendering.
 *
 * Each leaf gets the next integer x-coordinate from left to right. Pair nodes
 * sit between their children. Node ids are stable path strings: `root0` is the
 * left branch of `root`, `root1` is the right branch, and so on.
 *
 * The layout expects only atoms, `()`, and binary pairs. Malformed arrays are
 * rejected so renderers can keep assumptions simple.
 *
 * @param {*} pair
 * @returns {{
 *   nodes: LayoutNode[],
 *   edges: LayoutEdge[],
 *   minX: number,
 *   maxX: number,
 *   minY: number,
 *   maxY: number,
 *   width: number,
 *   height: number
 * }}
 */
export function layout(pair) {
  const walk = (node, depth, id, nextLeafX) => {
    if (Array.isArray(node) && !isEmpty(node) && !isPair(node)) {
      throw new Error('Lists must be empty or pairs')
    }

    if (isLeaf(node) || isEmpty(node)) {
      const leaf =
        { id,
          kind: isEmpty(node) ? 'empty' : 'leaf',
          label: isEmpty(node) ? '()' : String(node),
          x: nextLeafX,
          y: depth }
      return { nodes: [leaf], edges: [], x: leaf.x, nextLeafX: nextLeafX + 1 }
    }

    const leftId = `${id}0`
    const rightId = `${id}1`
    const left = walk(node[0], depth + 1, leftId, nextLeafX)
    const right = walk(node[1], depth + 1, rightId, left.nextLeafX)
    const x = (left.x + right.x) / 2

    return {
      nodes: [...left.nodes,
              ...right.nodes,
              { id, kind: 'pair', label: '·', x, y: depth }],
      edges: [{ from: id, to: leftId },
              { from: id, to: rightId },
              ...left.edges,
              ...right.edges],
      x,
      nextLeafX: right.nextLeafX
    }
  }

  const { nodes, edges } = walk(pair, 0, 'root', 0)
  const bounds = nodes.reduce((box, node) =>
    ({ minX: Math.min(box.minX, node.x),
       maxX: Math.max(box.maxX, node.x),
       maxY: Math.max(box.maxY, node.y) }),
                              { minX: 0, maxX: 0, maxY: 0 })

  return {
    nodes,
    edges,
    ...bounds,
    minY: 0,
    width: Math.max(bounds.maxX - bounds.minX, 1),
    height: bounds.maxY + 1
  }
}
