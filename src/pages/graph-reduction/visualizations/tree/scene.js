import { circle, g, line, pre, svg, text as svgText } from '@pfern/elements'
import { layout } from '../../layout.js'
import { serialize } from '../../sexpr.js'

const compare = (a, b) =>
  a.length - b.length || a.localeCompare(b)

const renderTree = (pair, event, frame) => {
  const tree = layout(pair)
  const bounds = frame ?? tree
  const id = event?.path ?? null
  const pad = 1
  const pos = new Map(tree.nodes.map(node => [node.id, node]))
  const edges = tree.edges
    .slice()
    .sort((a, b) => compare(a.to, b.to))
  const nodes = tree.nodes
    .slice()
    .sort((a, b) => compare(a.id, b.id))
  const key = `${serialize(pair)}:${id ?? 'none'}`

  return svg(
    { key,
      viewBox: `${bounds.minX - pad} ${bounds.minY - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`,
      role: 'img',
      'aria-label': 'Collapse tree' },
    g(
      { class: 'edge-layer' },
      ...edges.map(edge => {
        const from = pos.get(edge.from)
        const to = pos.get(edge.to)
        return !from || !to
          ? null
          : line(
            { key: `${edge.from}-${edge.to}`,
              class: 'edge',
              x1: from.x,
              y1: from.y,
              x2: to.x,
              y2: to.y })
      })),
    g(
      { class: 'node-layer' },
      ...nodes.map(node =>
        g(
          { key: node.id,
            class: ['node', node.id === id ? 'is-collapse' : null]
              .filter(Boolean)
              .join(' ') },
          circle(
            { cx: node.x,
              cy: node.y,
              r: node.kind === 'pair' ? 0.16 : 0.2 }),
          svgText(
            { x: node.x,
              y: node.y,
              'font-size': 0.24 },
            node.kind === 'pair' ? '·' : node.label)))))
}

export const scene = (pair, event = null, frame = null) =>
  pair === null
    ? pre('Parse an expression to view it.')
    : renderTree(pair, event, frame)

export default scene
