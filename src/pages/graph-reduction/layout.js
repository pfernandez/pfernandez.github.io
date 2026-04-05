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
  let nextLeafX = 0

  const walk = (pair, depth, id) => {
    if (Array.isArray(pair) && pair.length !== 0 && pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    if (isLeaf(pair) || isEmpty(pair)) {
      const x = nextLeafX++
      nodes.push(
        { id,
          kind: isEmpty(pair) ? 'empty' : 'leaf',
          label: isEmpty(pair) ? '()' : String(pair),
          x,
          y: depth })

      return x
    }

    const leftId = `${id}0`
    const rightId = `${id}1`
    edges.push({ from: id, to: leftId }, { from: id, to: rightId })

    const leftX = walk(pair[0], depth + 1, leftId)
    const rightX = walk(pair[1], depth + 1, rightId)
    const x = (leftX + rightX) / 2

    nodes.push(
      { id,
        kind: 'pair',
        label: '·',
        x,
        y: depth })

    return x
  }

  let minX = 0
  let maxX = 0
  let maxY = 0

  walk(pair, 0, 'root')

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
