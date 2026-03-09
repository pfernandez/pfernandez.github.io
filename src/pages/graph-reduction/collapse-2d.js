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
import { applyCollapse, findNextCollapse } from './collapse'
import { compileSource, layoutSnapshotTree, serializeGraph }
  from './collapse/utils'
import './collapse-2d.css'

const DEFAULT_SOURCE =
`; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x

((() ()) (() (a b)))`

const SOURCE_TEXTAREA_ID = 'collapse-source'

const initialCompiled = (() => {
  try {
    return compileSource(DEFAULT_SOURCE)
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

const recompile = nextSource => {
  try {
    return View({
      source: nextSource,
      compiled: compileSource(nextSource),
      error: null,
      history: []
    })
  } catch (e) {
    return View({
      source: nextSource,
      compiled: null,
      error: String(e?.message || e),
      history: []
    })
  }
}

const recompilePreservingFocus = (nextSource, event) => {
  const { target } = event
  const selection =
        typeof target?.selectionStart === 'number'
          ? { start: target.selectionStart, end: target.selectionEnd }
          : null
  const vnode = recompile(nextSource)
  restoreTextareaFocus(event, selection)
  return vnode
}

const View = component(({
  source = DEFAULT_SOURCE,
  compiled = initialCompiled,
  error = null,
  history = []
} = {}) => {

  const stepOnce = () => {
    let built
    try {
      built = compiled || compileSource(source)
    } catch (e) {
      return View(
        { source, compiled: null, error: String(e?.message || e), history })
    }

    const next = findNextCollapse(built.graph, built.rootId)
    return next
      ? View({ source,
               compiled: applyCollapse(built.graph, built.rootId, next),
               error: null,
               history: [...history,
                         { graph: built.graph, rootId: built.rootId }]})
      : View({ source, compiled: built, error: null, history })
  }

  const undo = () => history.length && View(
    { source,
      compiled: history[history.length - 1],
      error: null,
      history: history.slice(0, -1) })

  const nextFocusId =
      compiled?.graph && compiled?.rootId
        ? findNextCollapse(compiled.graph, compiled.rootId)?.nodeId ?? null
        : null

  const renderedExpr =
      compiled?.graph && compiled?.rootId
        ? serializeGraph(compiled.graph, compiled.rootId)
        : null

  const layout = layoutSnapshotTree(compiled.graph, compiled.rootId)

  console.log('%c5. edges for layout:', 'color: chocolate')
  console.table(layout.edges)

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
            g({ class: `node${n.id === nextFocusId ? ' focus' : ''}` },
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
                      recompilePreservingFocus(String(value ?? ''), event),
                    spellcheck: false })),
          div({ class: 'row' },
              button({ onclick: () => recompile(DEFAULT_SOURCE) }, 'Reset'),
              button({ onclick: stepOnce, disabled: !!error }, 'Step'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),
          div({ class: 'hint', style: { marginTop: '8px' }},
              `Steps: ${history.length}`,
              nextFocusId ? ' · Next: highlighted' : ' · Stuck'),
          error ? pre({ class: 'expr' }, error) : null,
          renderedExpr ? div(
            div({ class: 'hint', style: { marginTop: '10px' }}, 'Current'),
            pre({ class: 'expr' }, renderedExpr))
            : null),
      div({ class: 'panel' },
          tree ?? pre('Compile an expression to view it.'))))
})

export default () => div({ class: 'collapse-demo-root' }, View())

