import { pre } from '@pfern/elements'
import { appearance, billboard, coordinate, fontStyle, indexedLineSet,
         material, scene as x3scene, shape, sphere, transform, viewpoint,
         worldInfo, x3d, x3dtext }
  from '@pfern/elements-x3dom'
import { coordinateAxes, gridXY } from '../../../utils'
import { layout } from '../../layout.js'
import { build } from '../../links.js'
import { parse } from '../../sexpr.js'
import { DEFAULT_SOURCE } from '../dashboard.js'

const defaultPair = parse(DEFAULT_SOURCE)

const compare = (a, b) =>
  a.length - b.length || a.localeCompare(b)

const pos = ({ x, y, z }) => `${x} ${y} ${z}`

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

const renderLattice = (pair, event, frame) => {
  const tree = layout(pair)
  const refs = []

  try {
    build(pair, ref => refs.push(ref))
  } catch {}

  const id = event?.path ?? null
  const bounds = frame ?? tree
  const reach = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX), bounds.maxY + 1)
  const points = new Map(
    tree.nodes.map(node => [
      node.id,
      { x: node.x,
        y: -node.y,
        z: 0 }
    ]))
  const segments = tree.edges
    .slice()
    .sort((a, b) => compare(a.to, b.to))
    .map(edge => {
      const from = points.get(edge.from)
      const to = points.get(edge.to)
      return !from || !to ? null : [from, to]
    })
    .filter(Boolean)
  const linePoints = segments.flat()
  const lineIndex = segments.flatMap((_, index) =>
    [index * 2, index * 2 + 1, -1])
  const wires = refs
    .map(ref => {
      const from = points.get(ref.from)
      const to = points.get(ref.toPath)
      return !from || !to ? null : [from, to]
    })
    .filter(Boolean)
  const wirePoints = wires.flat()
  const wireIndex = wires.flatMap((_, index) =>
    [index * 2, index * 2 + 1, -1])
  const nodes = tree.nodes
    .slice()
    .sort((a, b) => compare(a.id, b.id))

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
      wirePoints.length === 0
        ? null
        : shape(
          appearance(
            material({ emissiveColor: '0.76 0.24 0.12' })),
          indexedLineSet(
            { coordIndex: wireIndex.join(' ') },
            coordinate({ point: wirePoints.map(pos).join(' ') }))),
      ...nodes.map(node => {
        const point = points.get(node.id)
        const nodeStyle = style(node, node.id === id)

        return transform(
          { translation: pos(point) },
          shape(
            appearance(
              material({ diffuseColor: nodeStyle.diffuseColor,
                         emissiveColor: nodeStyle.emissiveColor })),
            sphere({ radius: nodeStyle.radius })),
          node.kind === 'pair' ? null : label(node.label))
      })))
}

export const scene = (pair = defaultPair, event = null, frame = null) =>
  pair === null
    ? pre('Parse an expression to view it.')
    : renderLattice(pair, event, frame)

export default scene
