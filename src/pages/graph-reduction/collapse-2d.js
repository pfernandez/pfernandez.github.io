/**
 * Collapse interpreter page (keep-alive).
 *
 * This is the “small core” staging artifact:
 * - One binary pairs syntax.
 * - One local rewrite rule: `(() x) → x`.
 * - A deterministic schedule (leftmost-outermost).
 *
 * The point is to watch collapse happen on-screen without any heavy rendering
 * stack. This should stay small enough to port to WASM later.
 */
import { article, button, circle, component, div, g, h2, label, line, p,
         pre, section, svg, text as svgText, textarea } from '@pfern/elements'
import { collapse } from './collapse/index.js'
import { layout } from './collapse/utils/layout.js'
import { parse, show } from './collapse/utils/sexpr.js'
import './collapse-2d.css'

const DEFAULT_SOURCE =
`; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x

((() ()) (() (a b)))`

const read = source => {
  try {
    return { pair: parse(source), error: null }
  } catch (e) {
    return { pair: null, error: String(e?.message || e) }
  }
}

const initial = read(DEFAULT_SOURCE)

const setSource = nextSource =>
  View({ source: nextSource, ...read(nextSource), history: []})

const View = component(({
  source = DEFAULT_SOURCE,
  pair = initial.pair,
  error = initial.error,
  history = []
} = {}) => {
  const next = pair !== null ? collapse(pair) : null

  const stepOnce = () => {
    if (pair === null) return View({ source, pair, error, history })

    return next !== null
      ? View({
        source,
        pair: next,
        error: null,
        history: [...history, pair]
      })
      : View({ source, pair, error: null, history })
  }

  const undo = () => history.length && View(
    { source,
      pair: history[history.length - 1],
      error: null,
      history: history.slice(0, -1) })

  const text = pair !== null ? show(pair) : null

  const picture = pair !== null ? layout(pair) : null

  const scaleX = picture ? 120 : 1
  const scaleY = picture ? 80 : 1
  const padding = 40
  const viewW = picture ? picture.width * scaleX + padding * 2 : 800
  const viewH = picture ? picture.height * scaleY + padding * 2 : 420
  const nodePos = new Map(picture?.nodes.map(node => [node.id, node]))

  const tree = picture
    ? svg({ viewBox: `0 0 ${viewW} ${viewH}`,
            role: 'img',
            'aria-label': 'Collapse tree' },
          ...picture.edges.map(e => {
            const from = nodePos.get(e.from)
            const to = nodePos.get(e.to)
            if (!from || !to) return null
            return line({ class: 'edge',
                          x1: padding + from.x * scaleX,
                          y1: padding + from.y * scaleY,
                          x2: padding + to.x * scaleX,
                          y2: padding + to.y * scaleY })
          }),
          ...picture.nodes.map(n =>
            g({ class: 'node' },
              circle({ cx: padding + n.x * scaleX,
                       cy: padding + n.y * scaleY,
                       r: n.kind === 'pair' ? 12 : 16 }),
              svgText({ x: padding + n.x * scaleX,
                        y: padding + n.y * scaleY },
                      n.kind === 'pair' ? '·' : n.label))))
    : null

  return article(
    section(
      { class: 'collapse-demo' },
      div({ class: 'panel' },
          h2('Collapse interpreter'),
          p({ class: 'hint' },
            'Binary pairs only: `()` or `(a b)`. One rule: `(() x) → x`.'),
          label('Program / term',
                textarea(
                  { value: source,
                    oninput: value =>
                      setSource(String(value ?? '')),
                    spellcheck: false })),
          div({ class: 'row' },
              button({ onclick: () => setSource(DEFAULT_SOURCE) }, 'Reset'),
              button({ onclick: stepOnce, disabled: !!error }, 'Step'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),
          div({ class: 'hint', style: { marginTop: '8px' }},
              `Steps: ${history.length}`,
              next !== null ? ' · Reducible' : ' · Stuck'),
          error ? pre({ class: 'expr' }, error) : null,
          text ? div(
            div({ class: 'hint', style: { marginTop: '10px' }}, 'Current'),
            pre({ class: 'expr' }, text))
            : null),
      div({ class: 'panel' },
          tree ?? pre('Parse an expression to view it.'))))
})

export default () => div({ class: 'collapse-demo-root' }, View())
