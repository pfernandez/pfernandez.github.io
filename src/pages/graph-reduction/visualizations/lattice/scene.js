import { pre } from '@pfern/elements'
import { appearance, billboard, coordinate, fontStyle, indexedLineSet,
         material, scene as x3scene, shape, sphere, transform, viewpoint,
         worldInfo, x3d, x3dtext }
  from '@pfern/elements-x3dom'
import { coordinateAxes, gridXY } from '../../../utils'
import { layout } from '../../layout.js'
import { build, materialize } from '../../links.js'
import { parse } from '../../sexpr.js'
import DEFAULT_SOURCE from '../../source.lisp?raw'

const compare = (a, b) =>
  a.length - b.length || a.localeCompare(b)

const pos = ({ x, y, z }) => `${x} ${y} ${z}`

const representative = (paths, byPath) => {
  const path = paths.find(path => byPath.get(`${path}0`)?.kind === 'empty')
  return path ? `${path}0` : paths[0]
}

const graph = model => {
  const ids = new Map()
  const tree = layout(materialize(...model, ids))
  const canonical = id => ids.get(id) ?? id
  const byPath = new Map(tree.nodes.map(node => [node.id, node]))
  const groups = new Map()
  const points = new Map()

  tree.nodes
    .slice()
    .sort((a, b) => compare(a.id, b.id))
    .forEach(node => {
      const id = canonical(node.id)
      const group = groups.get(id) ?? []
      group.push(node.id)
      groups.set(id, group)
    })

  groups.forEach((paths, id) => {
    const path = representative(paths, byPath)
    const node = byPath.get(path)
    points.set(id, { ...node, id, x: node.x, y: -node.y, z: 0 })
  })

  const seen = new Set()
  const segments = tree.edges
    .slice()
    .sort((a, b) => compare(a.to, b.to))
    .map(edge => {
      const from = canonical(edge.from)
      const to = canonical(edge.to)
      const key = `${from}:${to}`

      return from === to || seen.has(key)
        ? null
        : (seen.add(key), [points.get(from), points.get(to)])
    })
    .filter(Boolean)

  const nodes = [...points.values()]

  return { tree, segments, nodes, canonical }
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

const renderLattice = (event, frame, model) => {
  const { tree, segments, nodes, canonical } = graph(model)
  const id = event?.path ? canonical(event.path) : null
  const bounds = frame ?? tree
  const reach = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX), bounds.maxY + 1)
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

export const scene = (pair, event = null, frame = null, model) =>
  pair === null
    ? pre('Parse an expression to view it.')
    : renderLattice(
      event,
      frame,
      model ?? build(pair ?? parse(DEFAULT_SOURCE)))

export default scene
