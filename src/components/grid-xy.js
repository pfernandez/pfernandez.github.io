import { color, coordinate, group, indexedLineSet, shape, transform }
  from '@pfern/elements-3d'


/**
 * Generates X3DOM grid data with specific colors for sub-grid vs integer lines
 * @param {number} s - Cell Size (e.g., 0.5)
 * @param {number} d - Dimensions (e.g., 20)
 */
const coordinates = (s, d) => {
  const count = Math.round(d / s) + 1
  const half = d / 2

  // Generate the numeric range of positions
  const range = Array.from({ length: count }, (_, i) =>
    Number((-half + i * s).toFixed(4)))

  return {
    // 1. Points: Start and End rows
    point: [...range.map(x => `${x} 0 ${half}`),
            ...range.map(x => `${x} 0 ${-half}`)].join(' '),

    // 2. Connections: Point i to i + count
    coordIndex: range.map((_, i) => `${i} ${i + count} -1`).join(' '),

    // 3. Color Index: Must match the number of lines in coordIndex
    // Highlights the center axis (index where x is near 0) with color 1, others
    // with color 0
    // colorIndex: range.map(x => Math.abs(x) < 0.001 ? '1' : '0').join(' ')
    // 3. Color Logic: Axis -> 2, Integer -> 1, Sub-grid -> 0
    colorIndex: range.map(x =>
      Math.abs(x) < 0.001 ? 2 : Number.isInteger(x) ? 1 : 0).join(' ')
  }
}


const { coordIndex, colorIndex, point } = coordinates(.5, 15)

export const gridXY = () =>
  group(
    transform(
      { DEF: 'GridLocation', rotation: '1 0 0 1.57079' },
      shape(
        { DEF: 'LinesAlignedAlongZ' },
        indexedLineSet(
          { colorIndex, colorPerVertex: 'false', coordIndex },
          coordinate(
            { DEF: 'EndPoints', point }),
          color({ color: '0.4 0.4 0.4 0.8 0.2 0 0.4 0.1 0.05' }))),
      transform({ DEF: 'LinesAlignedAlongX', rotation: '0 1 0 1.57079' },
                shape({ USE: 'LinesAlignedAlongZ' }))))

