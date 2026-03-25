/**
 * @module layout
 *
 * Deterministic tree layout for pair snapshots.
 */

const isEmpty = pair => Array.isArray(pair) && pair.length === 0

const isLeaf = pair => !Array.isArray(pair)

const maxDepthOf = (pair, depth = 0) =>
  isLeaf(pair) || isEmpty(pair)
    ? depth
    : Array.isArray(pair) && pair.length === 2
      ? Math.max(maxDepthOf(pair[0], depth + 1), maxDepthOf(pair[1], depth + 1))
      : (() => {
        throw new Error('Lists must be empty or pairs')
      })()

export function layout(pair) {
  const nodes = []
  const edges = []
  const depthLimit = maxDepthOf(pair)
  let minX = 0
  let maxX = 0
  let maxY = 0

  const walk = (pair, depth, x, id) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, depth)

    if (Array.isArray(pair) && pair.length !== 0 && pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    if (isLeaf(pair) || isEmpty(pair)) {
      nodes.push({
        id,
        kind: isEmpty(pair) ? 'empty' : 'leaf',
        label: isEmpty(pair) ? '()' : String(pair),
        x,
        y: depth
      })
      return
    }

    const leftId = `${id}0`
    const rightId = `${id}1`
    const step = 2 ** Math.max(depthLimit - depth - 1, 0)

    edges.push({ from: id, to: leftId }, { from: id, to: rightId })

    walk(pair[0], depth + 1, x - step, leftId)
    walk(pair[1], depth + 1, x + step, rightId)

    nodes.push({
      id,
      kind: 'pair',
      label: '·',
      x,
      y: depth
    })
  }

  walk(pair, 0, 0, 'root')

  return {
    nodes,
    edges,
    minX,
    maxX,
    minY: 0,
    maxY,
    width: maxX - minX + 1,
    height: maxY + 1
  }
}
