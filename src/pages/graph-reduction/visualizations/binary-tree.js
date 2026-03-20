/**
 * Binary tree collapse page (keep-alive).
 *
 * This is the “small core” staging artifact:
 * - One binary pairs syntax.
 * - One local rewrite rule: `(() x) → x`.
 * - A deterministic schedule (leftmost-outermost).
 *
 * The point is to watch collapse happen on-screen without any heavy rendering
 * stack. This should stay small enough to port to WASM later.
 */
import { article, circle, component, div, g, line, pre, section,
         svg, text as svgText } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { traceCollapse } from '../collapse/index.js'
import { layout } from '../collapse/utils/layout.js'
import { parse } from '../collapse/utils/sexpr.js'
import './binary-tree.css'

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => readSource(View, source)

const describeTrace = frame =>
  ({ descend: `Trace: descend into ${frame.path}`,
     collapse: `Trace: collapse at ${frame.path}`,
     return: `Trace: return to ${frame.path}`,
     stable: `Trace: stable at ${frame.path}` }[frame.type])

const View = component(({
  source = DEFAULT_SOURCE,
  pair = initialPair,
  error = null,
  history = [],
  trace = null
} = {}) => {
  const currentFrame = trace ? trace.frames[trace.index] : null
  const shownPair = currentFrame?.term ?? pair
  const focusId = currentFrame?.path ?? null

  const step = () => {
    if (pair === null) return

    if (trace) {
      if (trace.index + 1 < trace.frames.length)
        return View({
          source,
          pair,
          error: null,
          history,
          trace: { ...trace, index: trace.index + 1 }
        })

      return View({
        source,
        pair: trace.after,
        error: null,
        history: trace.changed ? [...history, pair] : history,
        trace: null
      })
    }

    const nextTrace = traceCollapse(pair)

    return View({
      source,
      pair,
      error: null,
      history,
      trace: { ...nextTrace, index: 0 }
    })
  }

  const undo = () => {
    if (trace)
      return View({ source, pair, error: null, history, trace: null })

    return history.length && View(
      { source,
        pair: history[history.length - 1],
        error: null,
        history: history.slice(0, -1),
        trace: null })
  }

  const picture = shownPair !== null ? layout(shownPair) : null

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
            g({ class: ['node',
                        n.id === focusId ? 'is-focus' : null,
                        currentFrame?.type === 'collapse' && n.id === focusId
                          ? 'is-collapse'
                          : null].filter(Boolean).join(' ') },
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
      controlsPanel(
        { title: 'Binary tree',
          hint: 'Binary pairs only: `()` or `(a b)`. Reduce opens a trace; Next advances it.',
          source,
          history,
          error,
          onSource: setSource,
          onReset: () => setSource(DEFAULT_SOURCE),
          onReduce: step,
          onUndo: undo,
          reduceLabel: trace ? 'Next' : 'Reduce',
          canUndo: !!trace || history.length > 0,
          status: currentFrame ? describeTrace(currentFrame) : null }),
      div({ class: 'panel' },
          tree ?? pre('Parse an expression to view it.'))))
})

export default () => div({ class: 'collapse-demo-root' }, View())
