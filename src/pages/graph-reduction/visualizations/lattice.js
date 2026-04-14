import { appearance, billboard, coordinate, fontStyle, indexedLineSet, material,
         shape, sphere, transform, viewpoint, worldInfo, x3d, x3dtext,
         scene as x3scene } from '@pfern/elements-x3dom'
import dashboard from './dashboard.js'

const isPair = node => Array.isArray(node) && node.length === 2
const isEmpty = node => Array.isArray(node) && node.length === 0
const isSlot = node =>
  typeof node === 'number' && Number.isInteger(node) && node >= 0

const H = Math.sqrt(3) / 2
const T = Math.sqrt(2 / 3)
const ROOT_TRIANGLE =
  [{ x: -0.5, y: -H / 3, z: 0 },
   { x: 0.5, y: -H / 3, z: 0 },
   { x: 0, y: (2 * H) / 3, z: 0 }]

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s })
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y,
                           y: a.z * b.x - a.x * b.z,
                           z: a.x * b.y - a.y * b.x })
const length = v => Math.hypot(v.x, v.y, v.z)
const unit = v => {
  const size = length(v)
  return size === 0 ? { x: 0, y: 0, z: 1 } : scale(v, 1 / size)
}
const pos = ({ x, y, z }) => `${x} ${y} ${z}`
const centroid = ([a, b, c]) => scale(add(add(a, b), c), 1 / 3)
const triNormal = ([a, b, c]) => unit(cross(sub(b, a), sub(c, a)))

const reflectAcrossEdge = (point, a, b) => {
  const edge = unit(sub(b, a))
  const projection = add(a, scale(edge, dot(sub(point, a), edge)))
  return sub(point, scale(sub(point, projection), 2))
}

const tetraApex = triangle =>
  add(centroid(triangle), scale(triNormal(triangle), T))

const leftChildTriangle = ([a, b, c]) => [a, c, reflectAcrossEdge(b, a, c)]

const rightChildTriangle = (triangle, lifted = false) => {
  const [a, b, c] = triangle
  return [c, b, lifted ? tetraApex(triangle) : reflectAcrossEdge(a, c, b)]
}

const rounded = n => Math.round(n * 1e6) / 1e6
const pointKey = point => `${rounded(point.x)},${rounded(point.y)},${rounded(point.z)}`
const segmentKey = (a, b) => {
  const left = pointKey(a)
  const right = pointKey(b)
  return left < right ? `${left}|${right}` : `${right}|${left}`
}

const nodeStyle = node =>
  isPair(node)
    ? { radius: 0.08,
        diffuseColor: '0.22 0.22 0.22',
        emissiveColor: '0.07 0.07 0.07' }
    : isSlot(node)
      ? { radius: 0.11,
          diffuseColor: '0.82 0.46 0.18',
          emissiveColor: '0.2 0.08 0.03' }
      : isEmpty(node)
        ? { radius: 0.11,
            diffuseColor: '0.72 0.58 0.14',
            emissiveColor: '0.16 0.12 0.02' }
        : { radius: 0.11,
            diffuseColor: '0.4 0.58 0.82',
            emissiveColor: '0.08 0.12 0.18' }

const label = text =>
  billboard(
    { axisOfRotation: '0 0 0' },
    transform(
      { translation: '0 0.18 0' },
      shape(
        appearance(
          material({ diffuseColor: '0.2 0.2 0.2',
                     emissiveColor: '0.08 0.08 0.08' })),
        x3dtext(
          { string: JSON.stringify(String(text)) },
          fontStyle({ family: '"SANS"',
                      justify: '"MIDDLE" "MIDDLE"',
                      size: '.13' })))))

const nodeAt = (node, point) => {
  const style = nodeStyle(node)
  return transform(
    { translation: pos(point) },
    shape(
      appearance(
        material({ diffuseColor: style.diffuseColor,
                   emissiveColor: style.emissiveColor })),
      sphere({ radius: style.radius })),
    isPair(node) ? null : label(isEmpty(node) ? '()' : node))
}

const isActiveApplication = node =>
  isPair(node) && isPair(node[0]) && isEmpty(node[0][0])

const edgeMap = cells => {
  const edges = new Map()
  cells.forEach(cell => {
    const vertices = cell.triangle
    ;[[vertices[0], vertices[1]],
      [vertices[1], vertices[2]],
      [vertices[2], vertices[0]]].forEach(([from, to]) => {
      const key = segmentKey(from, to)
      const tone = edges.get(key)
      if (!tone || cell.tone !== '0.25 0.25 0.25') {
        edges.set(key, { from, to, tone: cell.tone })
      }
    })
  })
  return [...edges.values()]
}

const walk = (node, triangle, search = true) => {
  const activeHere = search && isActiveApplication(node)
  const tone = activeHere ? '0.78 0.36 0.16' : '0.25 0.25 0.25'
  const cells = [{ triangle, tone }]
  const nodes = [{ node, point: centroid(triangle) }]
  const points = [...triangle, centroid(triangle)]

  if (!isPair(node)) return { cells, nodes, points }
  if (node.length === 0) return { cells, nodes, points }
  if (node.length !== 2) throw new Error('Lists must be empty or pairs')

  const left = walk(node[0], leftChildTriangle(triangle), search && !activeHere)
  const right = walk(node[1], rightChildTriangle(triangle, activeHere), false)

  return { cells: [...cells, ...left.cells, ...right.cells],
           nodes: [...nodes, ...left.nodes, ...right.nodes],
           points: [...points, ...left.points, ...right.points] }
}

const edgeShape = (edges, tone) => {
  if (!edges.length) return null

  const points = edges.flatMap(edge => [edge.from, edge.to])
  const index = edges.flatMap((_, position) => [position * 2, position * 2 + 1, -1])

  return shape(
    appearance(material({ emissiveColor: tone })),
    indexedLineSet(
      { coordIndex: index.join(' ') },
      coordinate({ point: points.map(pos).join(' ') })))
}

const latticeScene = pair => {
  const scene = walk(pair, ROOT_TRIANGLE)
  const edges = edgeMap(scene.cells)
  const baseEdges = edges.filter(edge => edge.tone === '0.25 0.25 0.25')
  const activeEdges = edges.filter(edge => edge.tone !== '0.25 0.25 0.25')
  const reach = Math.max(6,
                         Math.max(...scene.points.map(point =>
                           Math.max(Math.abs(point.x),
                                    Math.abs(point.y),
                                    Math.abs(point.z)))) + 2)

  return x3d(
    { width: '100%', height: '100%' },
    x3scene(
      worldInfo({ title: 'Lattice.x3d' }),
      viewpoint({ position: `0 0 ${reach}`,
                  centerOfRotation: '0 0 0',
                  description: 'Lattice' }),
      edgeShape(baseEdges, '0.25 0.25 0.25'),
      edgeShape(activeEdges, '0.78 0.36 0.16'),
      ...scene.nodes.map(({ node, point }) => nodeAt(node, point))))
}

export default dashboard(
  { className: 'lattice',
    title: 'Lattice',
    description: ['Each term occupies one equilateral cell in the mesh.',
                  'The next wrapper application lifts one child out of plane.']
      .join(' '),
    scene: latticeScene })
