import { pre } from '@pfern/elements'
import { appearance, billboard, coordinate, fontStyle, indexedLineSet,
         material, shape, sphere, transform, viewpoint, worldInfo,
         x3d, x3dtext, scene as x3scene }
  from '@pfern/elements-x3dom'
import { coordinateAxes, gridXY } from '../../utils'
import { dashboard } from './dashboard.js'

const compare = (a, b) =>
  a.length - b.length || a.localeCompare(b)

const isEmpty = pair => Array.isArray(pair) && pair.length === 0
const isLeaf = pair => !Array.isArray(pair)
const pos = ({ x, y, z }) => `${x} ${y} ${z}`
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s })
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y,
                           y: a.z * b.x - a.x * b.z,
                           z: a.x * b.y - a.y * b.x })
const length = v => Math.hypot(v.x, v.y, v.z)
const unit = v => {
  const size = length(v)
  return size === 0 ? { x: 1, y: 0, z: 0 } : scale(v, 1 / size)
}
const rotate = (v, axis, angle) => {
  const u = unit(axis)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return add(add(scale(v, c), scale(cross(u, v), s)),
             scale(u, dot(u, v) * (1 - c)))
}

const representative = (paths, byPath) => {
  const path = paths.find(path => byPath.get(`${path}0`)?.kind === 'empty')
  return path ? `${path}0` : paths[0]
}

const graph = pair => {
  // Canonicalize shared substructure by identity so repeated references render
  // as one node (DAG) rather than duplicated as a tree.
  const canonicalRef = new Map()
  const placed = new Map()
  const edges = []
  const h = Math.sqrt(3) / 2
  const fold = Math.acos(1 / 3)

  const place = (pair, path, point, forward, normal) => {
    if (Array.isArray(pair) && pair.length !== 0 && pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    const canonical =
      Array.isArray(pair)
        ? (canonicalRef.get(pair) ?? (canonicalRef.set(pair, path), path))
        : path

    placed.set(
      path,
      { id: path,
        canonical,
        kind: isEmpty(pair) ? 'empty' : isLeaf(pair) ? 'leaf' : 'pair',
        label: isEmpty(pair) ? '()' : isLeaf(pair) ? String(pair) : '·',
        x: point.x,
        y: point.y,
        z: point.z })

    if (isLeaf(pair) || isEmpty(pair)) return

    const tangent = unit(cross(normal, forward))
    const leftPoint = add(point, add(scale(forward, h), scale(tangent, -0.5)))
    const rightPoint = add(point, add(scale(forward, h), scale(tangent, 0.5)))
    const leftPath = `${path}0`
    const rightPath = `${path}1`
    const leftForward = unit(sub(leftPoint, point))
    const rightForward = unit(sub(rightPoint, point))
    const leftNormal = rotate(normal, leftForward, fold)
    const rightNormal = rotate(normal, rightForward, -fold)

    edges.push({ from: path, to: leftPath },
               { from: path, to: rightPath },
               { from: leftPath, to: rightPath })
    place(pair[0], leftPath, leftPoint, leftForward, leftNormal)
    place(pair[1], rightPath, rightPoint, rightForward, rightNormal)
  }

  place(pair, 'root',
        { x: 0, y: 0, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 })

  const byPath = new Map([...placed.entries()])
  const canonical = path => byPath.get(path)?.canonical ?? path
  const groups = new Map()
  const placedNodes = [...placed.values()]
  placedNodes
    .sort((a, b) => compare(a.id, b.id))
    .forEach(node => {
      const id = node.canonical
      const group = groups.get(id) ?? []
      group.push(node.id)
      groups.set(id, group)
    })

  const nodes = new Map()
  groups.forEach((paths, id) => {
    const path = representative(paths, byPath)
    const node = byPath.get(path)
    nodes.set(id, { ...node, id, path })
  })

  const seen = new Set()
  const segments = edges
    .sort((a, b) => compare(a.to, b.to))
    .map(edge => {
      const from = canonical(edge.from)
      const to = canonical(edge.to)
      const pair = `${from}:${to}`

      return from === to || seen.has(pair)
        ? null
        : (seen.add(pair), [nodes.get(from), nodes.get(to)])
    })
    .filter(Boolean)

  return { segments, nodes: [...nodes.values()], canonical }
}

const label = text =>
  billboard(
    { axisOfRotation: '0 0 0' },
    transform(
      { translation: '0 0.24 0' },
      shape(
        appearance(
          material({ diffuseColor: '0.2 0.2 0.2',
                     emissiveColor: '0.08 0.08 0.08' })),
        x3dtext(
          { string: JSON.stringify(String(text)) },
          fontStyle({ family: '"SANS"',
                      justify: '"MIDDLE" "MIDDLE"',
                      size: '.14' })))))

const style = (node, active) =>
  active
    ? { radius: node.kind === 'pair' ? 0.11 : 0.13,
        diffuseColor: '0.95 0.62 0.12',
        emissiveColor: '0.3 0.14 0.02' }
    : node.kind === 'pair'
      ? { radius: 0.1,
          diffuseColor: '0.22 0.22 0.22',
          emissiveColor: '0.07 0.07 0.07' }
      : node.kind === 'empty'
        ? { radius: 0.12,
            diffuseColor: '0.72 0.58 0.14',
            emissiveColor: '0.16 0.12 0.02' }
        : { radius: 0.12,
            diffuseColor: '0.4 0.58 0.82',
            emissiveColor: '0.08 0.12 0.18' }

const latticeScene = (pair, event = null) => {
  const { segments, nodes, canonical } = graph(pair)
  const id = event?.path ? canonical(event.path) : null
  const reach = Math.max(1, ...nodes.map(node =>
    Math.max(Math.abs(node.x), Math.abs(node.y), Math.abs(node.z)))) + 1
  const linePoints = segments.flat()
  const lineIndex = segments.flatMap((_, index) =>
    [index * 2, index * 2 + 1, -1])

  return x3d(
    { width: '100%', height: '100%' },
    x3scene(
      worldInfo({ title: 'Lattice.x3d' }),
      viewpoint({ position: `0 0 ${reach * 3 + 2}`,
                  description: 'Lattice' }),
      gridXY(),
      coordinateAxes(),
      linePoints.length === 0
        ? null
        : shape(
          appearance(
            material({ emissiveColor: '0.22 0.22 0.22' })),
          indexedLineSet(
            { coordIndex: lineIndex.join(' ') },
            coordinate({ point: linePoints.map(pos).join(' ') }))),
      ...nodes.map(node => {
        const nodeStyle = style(node, node.id === id)

        return transform(
          { translation: pos(node) },
          shape(
            appearance(
              material({ diffuseColor: nodeStyle.diffuseColor,
                         emissiveColor: nodeStyle.emissiveColor })),
            sphere({ radius: nodeStyle.radius })),
          node.kind === 'pair' ? null : label(node.label))
      })))
}

export default dashboard(
  { title: 'Lattice',
    hint: 'Suspends the current pair graph above the fixed observer plane. Shared substructure is merged by identity.',
    kind: 'lattice',
    scene: pair =>
      pair === null
        ? pre('Parse an expression to view it.')
        : latticeScene(pair) })
