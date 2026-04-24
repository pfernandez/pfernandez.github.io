import { appearance, billboard, coordinate, fontStyle, indexedLineSet,
         material, shape, sphere, transform, viewpoint, worldInfo, x3d,
         x3dtext, scene as x3scene } from
  '@pfern/elements-x3dom'
import dashboard from '../observer/dashboard.js'

/**
 * @module lattice
 *
 * Literal 3D sketch of the pair graph.
 */

const isList = Array.isArray
const isPair = node => isList(node) && node.length === 2
const isEmpty = node => isList(node) && node.length === 0
const isFixed = node => isPair(node) && node[0] === node

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s })
const length = v => Math.hypot(v.x, v.y, v.z)
const unit = v => length(v) ? scale(v, 1 / length(v)) : { x: 1, y: 0, z: 0 }
const pos = ({ x, y, z }) => `${x} ${y} ${z}`

const nodeKind = node =>
  isFixed(node)
    ? 'fixed'
    : isEmpty(node)
      ? 'empty'
      : isPair(node)
        ? 'pair'
        : 'atom'

const nodeLabel = node =>
  isEmpty(node)
    ? '()'
    : isFixed(node)
      ? 'fix'
      : isPair(node)
        ? '.'
        : String(node)

const NODE_STYLES =
  { atom: { radius: 0.1, color: '0.25 0.4 0.58' },
    empty: { radius: 0.1, color: '0.62 0.54 0.18' },
    fixed: { radius: 0.12, color: '0.86 0.56 0.22' },
    pair: { radius: 0.075, color: '0.16 0.16 0.16' } }

const childrenOf = node =>
  isEmpty(node) ? [] : isFixed(node) ? [node[1]] : isPair(node) ? node : []

const atomKey = node => `${typeof node}:${String(node)}`

const collectGraph = (
  node,
  indexes = { pairs: new Map(), atoms: new Map() }
) => {
  if (!isList(node)) {
    const key = atomKey(node)
    if (indexes.atoms.has(key)) {
      return { id: indexes.atoms.get(key), indexes, nodes: [], edges: [] }
    }

    const id = `atom:${indexes.atoms.size}`
    return { id,
             indexes: { ...indexes,
                        atoms: new Map(indexes.atoms).set(key, id) },
             nodes: [{ id, node, kind: 'atom' }],
             edges: [] }
  }

  if (node.length !== 0 && node.length !== 2) {
    throw new Error('Lists must be empty or pairs')
  }

  if (indexes.pairs.has(node)) {
    return { id: indexes.pairs.get(node), indexes, nodes: [], edges: [] }
  }

  const id = `pair:${indexes.pairs.size}`
  const pairs = new Map(indexes.pairs).set(node, id)
  const branches = childrenOf(node).reduce(
    (state, child) => {
      const branch = collectGraph(child, state.indexes)
      return { indexes: branch.indexes,
               items: [...state.items, branch] }
    },
    { indexes: { ...indexes, pairs }, items: [] })

  return {
    id,
    indexes: branches.indexes,
    nodes: [{ id, node, kind: nodeKind(node) },
            ...branches.items.flatMap(branch => branch.nodes)],
    edges: [...branches.items.map(branch => ({ from: id, to: branch.id })),
            ...branches.items.flatMap(branch => branch.edges)]
  }
}

const childrenById = edges =>
  edges.reduce((children, edge) =>
    new Map(children).set(edge.from,
                          [...(children.get(edge.from) ?? []), edge.to]),
  new Map())

const rawLayout = ({ id: root, edges }) => {
  const children = childrenById(edges)

  const place = (id, depth = 0, placed = new Map(), nextX = 0) => {
    if (placed.has(id)) return { placed, nextX, x: placed.get(id).x }

    const childIds = children.get(id) ?? []
    if (!childIds.length) {
      const point = { x: nextX, y: -depth, z: 0 }
      return { placed: new Map(placed).set(id, point),
               nextX: nextX + 1,
               x: point.x }
    }

    const result = childIds.reduce(
      (state, child) => place(child, depth + 1, state.placed, state.nextX),
      { placed, nextX, x: 0 })
    const x = childIds
      .map(child => result.placed.get(child).x)
      .reduce((sum, childX) => sum + childX, 0) / childIds.length

    return { placed: new Map(result.placed).set(id, { x, y: -depth, z: 0 }),
             nextX: result.nextX,
             x }
  }

  return place(root).placed
}

const centeredPoints = placed => {
  const bounds = [...placed.values()]
    .reduce((box, point) =>
      ({ minX: Math.min(box.minX, point.x),
         maxX: Math.max(box.maxX, point.x),
         minY: Math.min(box.minY, point.y),
         maxY: Math.max(box.maxY, point.y) }),
    { minX: 0, maxX: 0, minY: 0, maxY: 0 })
  const center = { x: (bounds.minX + bounds.maxX) / 2,
                   y: (bounds.minY + bounds.maxY) / 2,
                   z: 0 }

  return new Map([...placed].map(([id, point]) =>
    [id, scale(sub(point, center), 0.9)]))
}

const layoutGraph = graph => {
  const points = centeredPoints(rawLayout(graph))
  return { ...graph,
           nodes: graph.nodes.map(node => ({ ...node,
                                             point: points.get(node.id) })),
           points }
}

const fixedBasis = (node, child) =>
  ({ tangent: unit(sub(child.point, node.point)),
     surfaceNormal: { x: 0, y: 0, z: 1 } })

const loopPoints = ({ point }, basis, radius = 0.18, steps = 32) =>
  Array.from({ length: steps }, (_, index) => {
    const angle = (Math.PI * 2 * index) / steps
    return add(point,
               add(scale(basis.tangent, Math.cos(angle) * radius),
                   scale(basis.surfaceNormal, Math.sin(angle) * radius)))
  })

const label = text =>
  billboard(
    { axisOfRotation: '0 0 0' },
    transform(
      { translation: '0 0.2 0' },
      shape(
        appearance(material({ diffuseColor: '0.12 0.12 0.12',
                              emissiveColor: '0.08 0.08 0.08' })),
        x3dtext(
          { string: JSON.stringify(text) },
          fontStyle({ family: '"SANS"',
                      justify: '"MIDDLE" "MIDDLE"',
                      size: '.13' })))))

const nodeAt = ({ node, kind, point }) => {
  const style = NODE_STYLES[kind]

  return transform(
    { translation: pos(point) },
    shape(
      appearance(material({ diffuseColor: style.color,
                            emissiveColor: style.color })),
      sphere({ radius: style.radius })),
    label(nodeLabel(node)))
}

const lineShape = (segments, color = '0.18 0.18 0.18') =>
  segments.length
    ? shape(
      appearance(material({ emissiveColor: color })),
      indexedLineSet(
        { coordIndex: segments
          .flatMap((_, index) => [index * 2, index * 2 + 1, -1])
          .join(' ') },
        coordinate({ point: segments.flat().map(pos).join(' ') })))
    : null

const loopShape = (fixedNodes, payloadById) => {
  const rings = fixedNodes.map(node =>
    loopPoints(node, fixedBasis(node, payloadById.get(node.id))))
  const segments = rings.flatMap(points =>
    points.map((point, index) => [point, points[(index + 1) % points.length]]))

  return lineShape(segments, '0.78 0.42 0.12')
}

const reach = points =>
  Math.max(4,
           ...[...points.values()]
             .map(point => Math.max(Math.abs(point.x), Math.abs(point.y)))) + 2

const latticeScene = pair => {
  const graph = layoutGraph(collectGraph(pair))
  const fixedNodes = graph.nodes.filter(node => node.kind === 'fixed')
  const nodeById = new Map(graph.nodes.map(node => [node.id, node]))
  const fixedEdge = edge => nodeById.get(edge.from)?.kind === 'fixed'
  const edgeSegment = edge =>
    [graph.points.get(edge.from), graph.points.get(edge.to)]
  const structureEdges = graph.edges.filter(edge => !fixedEdge(edge))
  const payloadEdges = graph.edges.filter(fixedEdge)
  const payloadById = new Map(payloadEdges.map(edge =>
    [edge.from, nodeById.get(edge.to)]))

  return x3d(
    { width: '100%', height: '100%' },
    x3scene(
      worldInfo({ title: 'Lattice.x3d' }),
      viewpoint({ position: `0 0 ${reach(graph.points)}`,
                  centerOfRotation: '0 0 0',
                  description: 'Lattice' }),
      lineShape(structureEdges.map(edgeSegment)),
      lineShape(payloadEdges.map(edgeSegment), '0.78 0.42 0.12'),
      loopShape(fixedNodes, payloadById),
      ...graph.nodes.map(nodeAt)))
}

/**
 * Displays the current focus graph as a 3D lattice: spheres are vertices,
 * line segments are pair links, and fixed points render as standing loops.
 *
 * @returns {Function}
 */
export default dashboard(
  { className: 'lattice',
    title: 'Lattice',
    description: ['Literal graph sketch: pairs are line segments,',
                  'and fixed points are standing loops with payload spokes.']
      .join(' '),
    scene: latticeScene })
