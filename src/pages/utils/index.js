import { x3dswitch } from '@pfern/elements-x3dom'

export { gridXY } from './grid-xy'
export { coordinateAxes } from './coordinate-axes'

// Instantiate shared objects without rendering.
export const x3defs = (...defs) => x3dswitch({ whichChoice: -1 }, ...defs)

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

