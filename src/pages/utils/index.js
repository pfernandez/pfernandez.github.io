import { x3dswitch } from '@pfern/elements-x3dom'

export { gridXY } from './grid-xy'
export { coordinateAxes } from './coordinate-axes'

// Instantiate shared objects without rendering.
export const x3defs = (...defs) => x3dswitch({ whichChoice: -1 }, ...defs)

const isPlainObject = x =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

const prefixIfNeeded = (prefix, value) => {
  if (typeof value !== 'string') return value
  if (!value) return value
  return value.startsWith(prefix) ? value : `${prefix}${value}`
}

// X3DOM's DEF/USE values are effectively global in the document. If you render
// multiple copies of the same X3D graph (e.g. keep-alive routes + markdown
// embeds), duplicate DEF names can cause cross-scene collisions. This helper
// scopes DEF/USE (and related ROUTE node refs) under a unique prefix.
export const scopeX3Defs = (prefix, vnode) => {
  const p = String(prefix || '')
  if (!p) return vnode

  const seen = new WeakMap()

  const visit = node => {
    if (!Array.isArray(node)) return node
    const cached = seen.get(node)
    if (cached) return cached

    const tag = node[0]
    const props = node[1]
    const children = node.slice(2)

    let nextProps = props
    if (isPlainObject(props)) {
      const next = { ...props }

      'DEF' in next && (next.DEF = prefixIfNeeded(p, next.DEF))
      'def' in next && (next.def = prefixIfNeeded(p, next.def))
      'USE' in next && (next.USE = prefixIfNeeded(p, next.USE))
      'use' in next && (next.use = prefixIfNeeded(p, next.use))

      'fromNode' in next && (next.fromNode = prefixIfNeeded(p, next.fromNode))
      'toNode' in next && (next.toNode = prefixIfNeeded(p, next.toNode))
      'fromnode' in next && (next.fromnode = prefixIfNeeded(p, next.fromnode))
      'tonode' in next && (next.tonode = prefixIfNeeded(p, next.tonode))

      nextProps = next
    }

    const out = [tag, nextProps, ...children.map(visit)]
    seen.set(node, out)
    return out
  }

  return visit(vnode)
}

const range = n => [...Array(n).keys()]

/**
 * Generates X3DOM coordIndex for a rectangular grid of triangles with
 * IndexedFaceSet.
 * @param {number} rows - Number of points along the Y/Z axis
 * @param {number} cols - Number of points along the X axis
 * @returns {array} - The formatted coordIndex string
 */
export const generateTriangleIndices = (rows, cols) =>
  range(rows - 1)
    // Create a grid of cell coordinates
    .flatMap(r => range(cols - 1).map(c => ({ r, c })))
    .map(({ r, c }) => {
      const topLeft = r * cols + c
      const topRight = r * cols + (c + 1)
      const bottomLeft = (r + 1) * cols + c
      const bottomRight = (r + 1) * cols + (c + 1)

      return `${topLeft} ${topRight} ${bottomRight} -1
              ${bottomLeft} ${bottomRight} ${topRight} -1`
    })

/**
 * Generates X3DOM coordIndex for an IndexedLineSet (Wireframe)
 */
export const generateLineIndices = (rows, cols) => {
  const cells = range(rows - 1).flatMap(r =>
    range(cols - 1).map(c => ({ r, c })))

  const lines = cells.flatMap(({ r, c }) => {
    const topLeft = r * cols + c
    const topRight = r * cols + (c + 1)
    const bottomLeft = (r + 1) * cols + c
    // const bottomRight = (r + 1) * cols + (c + 1)

    // Define the edges for this specific cell
    return [
      `${topLeft} ${topRight}`,     // Top edge
      `${topLeft} ${bottomLeft}`,   // Left edge
      `${topRight} ${bottomLeft}`   // Your diagonal (1 to 3 pattern)
    ]
  })

  // Handle the "closing" edges for the far right and bottom boundary
  const rightBoundary = range(rows - 1).map(r =>
    `${r * cols + (cols - 1)} ${(r + 1) * cols + (cols - 1)}`)
  const bottomBoundary = range(cols - 1).map(c =>
    `${(rows - 1) * cols + c} ${(rows - 1) * cols + (c + 1)}`)

  return [...lines, ...rightBoundary, ...bottomBoundary]
    .map(line => `${line} -1`) // Add the delimiter to every segment
}
