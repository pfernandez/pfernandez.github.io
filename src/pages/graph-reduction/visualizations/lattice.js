import { appearance, billboard, coordinate, fontStyle, indexedLineSet, material,
         shape, sphere, transform, viewpoint, worldInfo, x3d, x3dtext,
         scene as x3scene } from '@pfern/elements-x3dom'
import dashboard from './dashboard.js'

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

const midpoint = (a, b) => scale(add(a, b), 0.5)

const initialFoldPoint = (left, right) => {
  const edge = sub(right, left)
  const along = unit(edge)
  const guideA = { x: 0, y: 0, z: 1 }
  const guideB = { x: 0, y: 1, z: 0 }
  const side =
    length(cross(along, guideA)) > 1e-6
      ? unit(cross(along, guideA))
      : unit(cross(along, guideB))
  const height = Math.sqrt(3) / 2
  return add(midpoint(left, right), scale(side, height))
}

const maxIndex = node => {
  if (typeof node === 'number' && Number.isInteger(node) && node >= 0)
    return node
  if (!Array.isArray(node) || node.length === 0) return -1
  if (node.length !== 2) throw new Error('Lists must be empty or pairs')
  return Math.max(maxIndex(node[0]), maxIndex(node[1]))
}

const isMotif = node => {
  if (typeof node === 'number' && Number.isInteger(node) && node >= 0)
    return true
  if (!Array.isArray(node)) return false
  if (node.length === 0) return true
  if (node.length !== 2) throw new Error('Lists must be empty or pairs')
  return isMotif(node[0]) && isMotif(node[1])
}

const collectIndexPaths = (node, path, out) => {
  if (typeof node === 'number' && Number.isInteger(node) && node >= 0) {
    const paths = out.get(node) ?? []
    paths.push(path)
    out.set(node, paths)
    return
  }

  if (!Array.isArray(node) || node.length === 0) return
  if (node.length !== 2) throw new Error('Lists must be empty or pairs')
  collectIndexPaths(node[0], `${path}0`, out)
  collectIndexPaths(node[1], `${path}1`, out)
}

const collectResolveAttachments = (
  term,
  path = 'root',
  counter = { value: 0 }
) => {
  const resolveHere = (node, nodePath) => {
    if (!Array.isArray(node) || node.length !== 2) return false

    const args = []
    let body = node
    let bodyPath = nodePath
    while (Array.isArray(body) && body.length === 2 && !isMotif(body)) {
      args.unshift({ path: `${bodyPath}1` })
      body = body[0]
      bodyPath = `${bodyPath}0`
    }

    if (!isMotif(body)) return false

    const arity = maxIndex(body) + 1
    if (arity === 0 || args.length !== arity) return false

    const slots = new Map()
    collectIndexPaths(body, bodyPath, slots)
    return [...slots.entries()]
      .flatMap(([index, paths]) =>
        paths.map(indexPath =>
          ({ id: `fold${counter.value++}`,
             left: indexPath,
             right: args[index].path })))
  }

  const attachments = resolveHere(term, path)
  if (attachments) return attachments
  if (!Array.isArray(term) || term.length !== 2) return []
  return collectResolveAttachments(term[0], `${path}0`, counter)
}

const relax = (nodes, segments, { iterations = 160, edgeLength = 1 } = {}) => {
  const byId = new Map(nodes.map(node => [node.id, { ...node }]))
  const fixed = new Set(['root'])

  for (let i = 0; i < iterations; i++) {
    for (const [from, to] of segments) {
      const a = byId.get(from.id || from)
      const b = byId.get(to.id || to)
      if (!a || !b) continue

      let delta = sub(b, a)
      let dist = length(delta)
      if (dist < 1e-6) {
        delta = { x: 1, y: 0, z: 0 }
        dist = 1
      }

      const dir = scale(delta, 1 / dist)
      const diff = dist - edgeLength
      const move = scale(dir, diff / 2)
      const aFixed = fixed.has(a.id)
      const bFixed = fixed.has(b.id)

      if (!aFixed && !bFixed) {
        a.x += move.x
        a.y += move.y
        a.z += move.z
        b.x -= move.x
        b.y -= move.y
        b.z -= move.z
      } else if (aFixed && !bFixed) {
        b.x -= move.x * 2
        b.y -= move.y * 2
        b.z -= move.z * 2
      } else if (!aFixed && bFixed) {
        a.x += move.x * 2
        a.y += move.y * 2
        a.z += move.z * 2
      }
    }
  }

  return [...byId.values()]
}

const graph = pair => {
  // Canonicalize shared substructure by identity so repeated references render
  // as one node (DAG) rather than duplicated as a tree.
  const canonicalRef = new Map()
  const attachments = collectResolveAttachments(pair)
  const placed = new Map()
  const edges = []
  const edgeLength = 1
  const spread = Math.PI / 6
  const fold = Math.acos(1 / 3)

  const place = (pair, path, point, forward, normal) => {
    if (Array.isArray(pair) && pair.length !== 0 && pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    const canonical =
      Array.isArray(pair)
        ? canonicalRef.get(pair) ?? (canonicalRef.set(pair, path), path)
        : path

    placed.set(
      path,
      { id: path,
        canonical,
        kind: isEmpty(pair)
          ? 'empty'
          : isLeaf(pair)
            ? typeof pair === 'number' && Number.isInteger(pair) && pair >= 0
              ? 'slot'
              : 'leaf'
            : 'pair',
        label: isEmpty(pair) ? '()' : isLeaf(pair) ? String(pair) : '·',
        x: point.x,
        y: point.y,
        z: point.z })

    if (isLeaf(pair) || isEmpty(pair)) return

    const leftDir = unit(rotate(forward, normal, spread))
    const rightDir = unit(rotate(forward, normal, -spread))
    const leftPoint = add(point, scale(leftDir, edgeLength))
    const rightPoint = add(point, scale(rightDir, edgeLength))
    const leftPath = `${path}0`
    const rightPath = `${path}1`
    const leftNormal = rotate(normal, leftDir, fold)
    const rightNormal = rotate(normal, rightDir, -fold)

    edges.push({ from: path, to: leftPath },
               { from: path, to: rightPath },
               { from: leftPath, to: rightPath })
    place(pair[0], leftPath, leftPoint, leftDir, leftNormal)
    place(pair[1], rightPath, rightPoint, rightDir, rightNormal)
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
      const id = canonical(node.id)
      const group = groups.get(id) ?? []
      group.push(node.id)
      groups.set(id, group)
    })

  const nodes = new Map()
  groups.forEach((paths, id) => {
    const samples = paths.map(path => byPath.get(path))
    const base = samples.find(node => node.id === id) ?? samples[0]
    const total = samples.reduce(
      (sum, node) => add(sum, node),
      { x: 0, y: 0, z: 0 })
    const point = scale(total, 1 / samples.length)

    nodes.set(id,
              { ...base,
                id,
                x: point.x,
                y: point.y,
                z: point.z })
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

  for (const attachment of attachments) {
    const left = nodes.get(canonical(attachment.left))
    const right = nodes.get(canonical(attachment.right))
    if (!left || !right) continue

    const parent =
      { id: attachment.id,
        kind: 'pair',
        label: '·',
        ...initialFoldPoint(left, right) }

    nodes.set(parent.id, parent)
    segments.push([parent, left], [parent, right], [left, right])
  }

  const relaxedNodes = relax([...nodes.values()], segments, { edgeLength })
  const relaxedById = new Map(relaxedNodes.map(node => [node.id, node]))
  const relaxedSegments = segments
    .map(([from, to]) => [relaxedById.get(from.id), relaxedById.get(to.id)])
    .filter(([from, to]) => from && to)

  return { segments: relaxedSegments, nodes: relaxedNodes }
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

const style = node =>
  node.kind === 'pair'
    ? { radius: 0.1,
        diffuseColor: '0.22 0.22 0.22',
        emissiveColor: '0.07 0.07 0.07' }
    : node.kind === 'slot'
      ? { radius: 0.12,
          diffuseColor: '0.82 0.46 0.18',
          emissiveColor: '0.2 0.08 0.03' }
      : node.kind === 'empty'
        ? { radius: 0.12,
            diffuseColor: '0.72 0.58 0.14',
            emissiveColor: '0.16 0.12 0.02' }
        : { radius: 0.12,
            diffuseColor: '0.4 0.58 0.82',
            emissiveColor: '0.08 0.12 0.18' }

const latticeScene = pair => {
  const { segments, nodes } = graph(pair)
  const reach = Math.max(1, ...nodes.map(node =>
    Math.max(Math.abs(node.x), Math.abs(node.y), Math.abs(node.z)))) + 1
  const linePoints = segments.flat()
  const lineIndex = segments.flatMap((_, index) =>
    [index * 2, index * 2 + 1, -1])

  return x3d(
    { width: '100%', height: '100%' },
    x3scene(
      worldInfo({ title: 'Lattice.x3d' }),
      viewpoint({ position: `0 0 ${reach * 2.8}`,
                  centerOfRotation: '0 0 0',
                  description: 'Lattice' }),
      linePoints.length === 0
        ? null
        : shape(
          appearance(
            material({ emissiveColor: '0.25 0.25 0.25' })),
          indexedLineSet(
            { coordIndex: lineIndex.join(' ') },
            coordinate({ point: linePoints.map(pos).join(' ') }))),
      ...nodes.map(node => {
        const nodeStyle = style(node)

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
  { className: 'lattice',
    title: 'Lattice',
    description: ['Root stays at the origin.',
                  'Each pair forms a local equilateral triangle;',
                  'shared structure is merged by identity.'].join(' '),
    scene: latticeScene })

