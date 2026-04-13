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
const ROOT = { x: 0, y: 0, z: 0 }
const ROOT_AWAY = { x: 0, y: -1, z: 0 }
const ROOT_NORMAL = { x: 0, y: 0, z: 1 }

const pos = ({ x, y, z }) => `${x} ${y} ${z}`
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z })
const scale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s })
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y,
                           y: a.z * b.x - a.x * b.z,
                           z: a.x * b.y - a.y * b.x })
const length = v => Math.hypot(v.x, v.y, v.z)
const unit = v => {
  const size = length(v)
  return size === 0 ? ROOT_NORMAL : scale(v, 1 / size)
}

const branchVectors = (away, normal, lifted = false) => {
  const side = unit(cross(away, normal))
  const left = add(scale(away, H), scale(side, 0.5))
  const right =
    lifted
      ? add(scale(away, (2 * H) / 3), scale(normal, T))
      : add(scale(away, H), scale(side, -0.5))

  return { left, right, normal: unit(cross(left, right)) }
}

const pairWire = (right, tone = '0.25 0.25 0.25') =>
  shape(
    appearance(material({ emissiveColor: tone })),
    indexedLineSet(
      { coordIndex: '0 1 2 0 -1' },
      coordinate({ point: [ROOT,
                           add(ROOT, right.left),
                           add(ROOT, right.right)].map(pos).join(' ') })))

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
      { translation: '0 0.21 0' },
      shape(
        appearance(
          material({ diffuseColor: '0.2 0.2 0.2',
                     emissiveColor: '0.08 0.08 0.08' })),
        x3dtext(
          { string: JSON.stringify(String(text)) },
          fontStyle({ family: '"SANS"',
                      justify: '"MIDDLE" "MIDDLE"',
                      size: '.13' })))))

const atom = node => {
  const style = nodeStyle(node)
  return transform(
    shape(
      appearance(
        material({ diffuseColor: style.diffuseColor,
                   emissiveColor: style.emissiveColor })),
      sphere({ radius: style.radius })),
    isPair(node) ? null : label(isEmpty(node) ? '()' : node))
}

const isActiveApplication = node =>
  isPair(node) && isPair(node[0]) && isEmpty(node[0][0])

const depth = node =>
  !isPair(node) ? 1 : 1 + Math.max(depth(node[0]), depth(node[1]))

const nodeAt = (node, point) =>
  transform({ translation: pos(point) }, atom(node))

const walk = (node, frame, search = true) => {
  const origin = frame.origin

  if (!Array.isArray(node)) {
    return { shapes: [nodeAt(node, origin)], reach: Math.max(Math.abs(origin.x),
                                                             Math.abs(origin.y),
                                                             Math.abs(origin.z)) }
  }

  if (node.length === 0) {
    return { shapes: [nodeAt(node, origin)], reach: Math.max(Math.abs(origin.x),
                                                             Math.abs(origin.y),
                                                             Math.abs(origin.z)) }
  }

  if (node.length !== 2) throw new Error('Lists must be empty or pairs')

  const activeHere = search && isActiveApplication(node)
  const branches = branchVectors(frame.away, frame.normal, activeHere)
  const leftPoint = add(origin, branches.left)
  const rightPoint = add(origin, branches.right)
  const tone =
    activeHere
      ? '0.78 0.36 0.16'
      : '0.25 0.25 0.25'

  const leftWalk = walk(node[0],
                        { origin: leftPoint,
                          away: scale(branches.left, -1),
                          normal: branches.normal },
                        search && !activeHere)
  const rightWalk = walk(node[1],
                         { origin: rightPoint,
                           away: scale(branches.right, -1),
                           normal: branches.normal },
                         false)

  return {
    shapes: [
      transform({ translation: pos(origin) }, pairWire(branches, tone)),
      nodeAt(node, origin),
      ...leftWalk.shapes,
      ...rightWalk.shapes
    ],
    reach: Math.max(Math.abs(origin.x),
                    Math.abs(origin.y),
                    Math.abs(origin.z),
                    leftWalk.reach,
                    rightWalk.reach)
  }
}

const latticeScene = pair => {
  const scene =
    walk(pair, { origin: ROOT, away: ROOT_AWAY, normal: ROOT_NORMAL })
  const reach = Math.max(6, scene.reach + depth(pair) * 0.4 + 2)
  return x3d(
    { width: '100%', height: '100%' },
    x3scene(
      worldInfo({ title: 'Lattice.x3d' }),
      viewpoint({ position: `0 0 ${reach}`,
                  centerOfRotation: '0 0 0',
                  description: 'Lattice' }),
      ...scene.shapes))
}

export default dashboard(
  { className: 'lattice',
    title: 'Lattice',
    description: ['Uniform equilateral pair cells with no recursive shrink.',
                  'The next wrapper pair lifts onto the tetrahedral face.']
      .join(' '),
    scene: latticeScene })
