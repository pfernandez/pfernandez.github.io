import { circle, g, line, pre, svg, text as svgText } from '@pfern/elements'
import { layout } from '../collapse/utils/layout.js'
import { serialize } from '../collapse/utils/sexpr.js'

const comparePathIds = (a, b) =>
  a.length - b.length || a.localeCompare(b)

export const renderBinaryTreeScene = (pair, frame = null) => {
  if (pair === null) {
    return pre('Parse an expression to view it.')
  }

  const picture = layout(pair)
  const focusId = frame?.path ?? null
  const scaleX = 120
  const scaleY = 80
  const padding = 40
  const viewW = picture.width * scaleX + padding * 2
  const viewH = picture.height * scaleY + padding * 2
  const nodePos = new Map(picture.nodes.map(node => [node.id, node]))
  const edges = picture.edges
    .slice()
    .sort((a, b) => comparePathIds(a.to, b.to))
  const nodes = picture.nodes
    .slice()
    .sort((a, b) => comparePathIds(a.id, b.id))
  const treeKey = `${serialize(pair)}:${focusId ?? 'none'}:${frame?.type ?? 'idle'}`

  return svg(
    { key: treeKey,
      viewBox: `0 0 ${viewW} ${viewH}`,
      role: 'img',
      'aria-label': 'Collapse tree' },
    g(
      { class: 'edge-layer' },
      ...edges.map(edge => {
        const from = nodePos.get(edge.from)
        const to = nodePos.get(edge.to)
        if (!from || !to) return null

        return line(
          { key: `${edge.from}-${edge.to}`,
            class: 'edge',
            x1: padding + from.x * scaleX,
            y1: padding + from.y * scaleY,
            x2: padding + to.x * scaleX,
            y2: padding + to.y * scaleY })
      })
    ),
    g(
      { class: 'node-layer' },
      ...nodes.map(node =>
        g(
          { key: node.id,
            class: ['node',
                    node.id === focusId ? 'is-focus' : null,
                    frame?.type === 'collapse' && node.id === focusId
                      ? 'is-collapse'
                      : null].filter(Boolean).join(' ') },
          circle(
            { cx: padding + node.x * scaleX,
              cy: padding + node.y * scaleY,
              r: node.kind === 'pair' ? 12 : 16 }),
          svgText(
            { x: padding + node.x * scaleX,
              y: padding + node.y * scaleY },
            node.kind === 'pair' ? '·' : node.label)))))
}
