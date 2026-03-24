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
  let leafX = 0
  let maxDepth = 0

  const walk = (pair, depth, id) => {
    maxDepth = Math.max(maxDepth, depth)

    if (Array.isArray(pair) && pair.length !== 0 && pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    if (isLeaf(pair) || isEmpty(pair)) {
      const x = leafX++
      nodes.push({
        id,
        kind: isEmpty(pair) ? 'empty' : 'leaf',
        label: isEmpty(pair) ? '()' : String(pair),
        x,
        y: depth
      })
      return x
    }

    const leftId = `${id}0`
    const rightId = `${id}1`

    edges.push({ from: id, to: leftId }, { from: id, to: rightId })

    const leftX = walk(pair[0], depth + 1, leftId)
    const rightX = walk(pair[1], depth + 1, rightId)
    const x = (leftX + rightX) / 2

    nodes.push({
      id,
      kind: 'pair',
      label: '·',
      x,
      y: depth
    })
    return x
  }

  walk(pair, 0, 'root')

  return {
    nodes,
    edges,
    width: Math.max(1, leafX),
    height: maxDepth + 1
  }
}
