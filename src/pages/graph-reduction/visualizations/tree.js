import { circle, g, line, pre, svg, text as svgText } from '@pfern/elements'
import dashboard from './dashboard.js'
import { layout } from '../layout.js'
import { serialize } from '../sexpr.js'

const compare = (a, b) =>
  a.length - b.length || a.localeCompare(b)

const scene = pair => {
  const tree = layout(pair)
  const bounds = tree
  const pad = 1
  const scale = 2
  const pos = new Map(tree.nodes.map(node => [node.id, node]))
  const edges = tree.edges
    .slice()
    .sort((a, b) => compare(a.to, b.to))
  const nodes = tree.nodes
    .slice()
    .sort((a, b) => compare(a.id, b.id))
  const key = serialize(pair)
  const width = (bounds.width + pad * 2) * scale
  const height = (bounds.height + pad * 2) * scale
  const centerX = bounds.minX + bounds.width / 2
  const centerY = bounds.minY + bounds.height / 0.9
  const minX = centerX - width / 2
  const minY = centerY - height / 2

  return pair === null
    ? pre('Parse an expression to view it.')
    : svg({ key,
            viewBox: `${minX} ${minY} ${width} ${height}`,
            role: 'img',
            'aria-label': 'Collapse tree' },
          g({ class: 'edge-layer' },
            ...edges.map(edge => {
              const from = pos.get(edge.from)
              const to = pos.get(edge.to)
              return !from || !to
                ? null
                : line({ key: `${edge.from}-${edge.to}`,
                         class: 'edge',
                         x1: from.x,
                         y1: from.y,
                         x2: to.x,
                         y2: to.y })
            })),
          g({ class: 'node-layer' },
            ...nodes.map(node =>
              g({ key: node.id, class: 'node' },
                circle({ cx: node.x,
                         cy: node.y,
                         r: node.kind === 'pair' ? 0.16 : 0.2 }),
                svgText({ x: node.x,
                          y: node.y,
                          'font-size': 0.24 },
                        node.kind === 'pair' ? '·' : node.label)))))
}

export default dashboard(
  { className: 'tree',
    title: 'Tree',
    description: ['Binary pairs only: `()` or `(a b)`.',
                  'Observation performs one tick.'].join(' '),
    scene })
