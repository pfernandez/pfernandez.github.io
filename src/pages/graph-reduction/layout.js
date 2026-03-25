/**
 * @module layout
 *
 * Deterministic tree layout for pair snapshots.
 */

const isEmpty = pair => Array.isArray(pair) && pair.length === 0

const isLeaf = pair => !Array.isArray(pair)

export function layout(pair) {
  const nodes = []
  const edges = []

  const walk = (pair, depth, x, id) => {
    if (Array.isArray(pair) && pair.length !== 0 && pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    nodes.push({
      id,
      kind: isEmpty(pair) ? 'empty' : isLeaf(pair) ? 'leaf' : 'pair',
      label: isEmpty(pair) ? '()' : isLeaf(pair) ? String(pair) : '·',
      x,
      y: depth
    })

    if (isLeaf(pair) || isEmpty(pair)) {
      return
    }

    const leftId = `${id}0`
    const rightId = `${id}1`
    const step = 2 / (depth + 2)

    edges.push({ from: id, to: leftId }, { from: id, to: rightId })
    walk(pair[0], depth + 1, x - step, leftId)
    walk(pair[1], depth + 1, x + step, rightId)
  }

  let minX = 0
  let maxX = 0
  let maxY = 0

  walk(pair, 0, 0, 'root')

  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    maxX = Math.max(maxX, node.x)
    maxY = Math.max(maxY, node.y)
  }

  return {
    nodes,
    edges,
    minX,
    maxX,
    minY: 0,
    maxY,
    width: Math.max(maxX - minX, 1),
    height: maxY + 1
  }
}
