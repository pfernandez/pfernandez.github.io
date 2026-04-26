import { circle, g, line, pre, svg, text as svgText } from '@pfern/elements'
import dashboard from '../observer/dashboard.js'
import { layout } from './layout.js'
import { parse, serialize } from '../graph/index.js'

/**
 * @module tree
 *
 * 2D tree rendering of the folding projection.
 */

const compare = (a, b) =>
  a.length - b.length || a.localeCompare(b)

const scene = ({ graph: pair, sequence, crossings }) => {
  if (pair === null) return pre('Parse an expression to view it.')

  const key = serialize(pair, sequence, crossings)
  const projected = parse(key)[0]
  const tree = layout(projected)
  const pad = 1
  const scale = 2
  const pos = new Map(tree.nodes.map(node => [node.id, node]))
  const edges = tree.edges
    .slice()
    .sort((a, b) => compare(a.to, b.to))
  const nodes = tree.nodes
    .slice()
    .sort((a, b) => compare(a.id, b.id))
  const width = (tree.width + pad * 2) * scale
  const height = (tree.height + pad * 2) * scale
  const centerX = tree.minX + tree.width / 2
  const centerY = tree.minY + tree.height / 0.9
  const minX = centerX - width / 2
  const minY = centerY - height / 2

  return svg({ key,
               viewBox: `${minX} ${minY} ${width} ${height}`,
               role: 'img',
               'aria-label': 'Folding projection tree' },
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

/**
 * Displays the current graph as a duplicated tree projection.
 *
 * The underlying live graph may share continuations; this view intentionally
 * duplicates shared nodes so the folding order stays readable.
 *
 * @returns {Function}
 */
export default dashboard(
  { className: 'tree',
    title: 'Tree',
    description: ['Folding projection of the current graph.',
                  'Shared arguments are shown as duplicated tree structure.']
      .join(' '),
    scene })
