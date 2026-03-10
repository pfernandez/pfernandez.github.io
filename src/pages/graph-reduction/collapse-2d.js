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
         pre, section, svg, text, textarea } from '@pfern/elements'
import { collapseOnce } from './collapse/index.js'
import { layoutSnapshotTree, parseSexpr, serializeSexpr }
  from './collapse/utils/index.js'
import './collapse-2d.css'

const DEFAULT_SOURCE =
`; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x

((() ()) (() (a b)))`

const SOURCE_TEXTAREA_ID = 'collapse-source'

const initialAst = (() => {
  try {
    return parseSexpr(DEFAULT_SOURCE)
  } catch {
    return null
  }
})()

const afterUpdate = fn =>
  typeof queueMicrotask === 'function'
    ? window.queueMicrotask(fn)
    : window.setTimeout(fn, 0)

const restoreTextareaFocus = (event, selection) =>
  event?.target
    && document.activeElement === event.target
    && selection
    && afterUpdate(() =>
      window.requestAnimationFrame(() => {
        const el = document.getElementById(SOURCE_TEXTAREA_ID)
        if (el instanceof window.HTMLTextAreaElement) {
          el.focus()
          try { el.setSelectionRange(selection.start, selection.end) }
          catch { /* Ignore selection restore failures */ }
        }
      }))

const reparse = nextSource => {
  try {
    return View({
      source: nextSource,
      ast: parseSexpr(nextSource),
      error: null,
      history: []
    })
  } catch (e) {
    return View({
      source: nextSource,
      ast: null,
      error: String(e?.message || e),
      history: []
    })
  }
}

const reparsePreservingFocus = (nextSource, event) => {
  const { target } = event
  const selection =
        typeof target?.selectionStart === 'number'
          ? { start: target.selectionStart, end: target.selectionEnd }
          : null
  const vnode = reparse(nextSource)
  restoreTextareaFocus(event, selection)
  return vnode
}

const View = component(({
  source = DEFAULT_SOURCE,
  ast = initialAst,
  error = null,
  history = []
} = {}) => {
  const nextStep = ast ? collapseOnce(ast) : null

  const stepOnce = () => {
    let currentAst
    try {
      currentAst = ast || parseSexpr(source)
    } catch (e) {
      return View(
        { source, ast: null, error: String(e?.message || e), history })
    }

    const step = collapseOnce(currentAst)
    return step.changed
      ? View({
        source,
        ast: step.ast,
        error: null,
        history: [...history, currentAst]
      })
      : View({ source, ast: currentAst, error: null, history })
  }

  const undo = () => history.length && View(
    { source,
      ast: history[history.length - 1],
      error: null,
      history: history.slice(0, -1) })

  const renderedExpr =
      ast
        ? serializeSexpr(ast)
        : null

  const layout =
      ast
        ? layoutSnapshotTree(ast, nextStep?.focusPath ?? null)
        : null

  const scaleX = layout ? 120 : 1
  const scaleY = layout ? 80 : 1
  const padding = 40
  const viewW = layout ? layout.width * scaleX + padding * 2 : 800
  const viewH = layout ? layout.height * scaleY + padding * 2 : 420
  const nodePos = new Map(layout?.nodes.map(n => [n.id, n]))

  const tree = layout
    ? svg({ viewBox: `0 0 ${viewW} ${viewH}`,
            role: 'img',
            'aria-label': 'Collapse tree' },
          ...layout.edges.map(e => {
            const from = nodePos.get(e.from)
            const to = nodePos.get(e.to)
            if (!from || !to) return null
            return line({ class: 'edge',
                          x1: padding + from.x * scaleX,
                          y1: padding + from.y * scaleY,
                          x2: padding + to.x * scaleX,
                          y2: padding + to.y * scaleY })
          }),
          ...layout.nodes.map(n =>
            g({ class: `node${n.focus ? ' focus' : ''}` },
              circle({ cx: padding + n.x * scaleX,
                       cy: padding + n.y * scaleY,
                       r: n.kind === 'pair' ? 12 : 16 }),
              text({ x: padding + n.x * scaleX,
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
                  { id: SOURCE_TEXTAREA_ID,
                    value: source,
                    oninput: (value, event) =>
                      reparsePreservingFocus(String(value ?? ''), event),
                    spellcheck: false })),
          div({ class: 'row' },
              button({ onclick: () => reparse(DEFAULT_SOURCE) }, 'Reset'),
              button({ onclick: stepOnce, disabled: !!error }, 'Step'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),
          div({ class: 'hint', style: { marginTop: '8px' }},
              `Steps: ${history.length}`,
              nextStep?.changed ? ' · Next: highlighted' : ' · Stuck'),
          error ? pre({ class: 'expr' }, error) : null,
          renderedExpr ? div(
            div({ class: 'hint', style: { marginTop: '10px' }}, 'Current'),
            pre({ class: 'expr' }, renderedExpr))
            : null),
      div({ class: 'panel' },
          tree ?? pre('Parse an expression to view it.'))))
})

export default () => div({ class: 'collapse-demo-root' }, View())
