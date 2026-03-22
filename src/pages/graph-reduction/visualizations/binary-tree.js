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
import { article, component, div, section } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { traceCollapse } from '../collapse/index.js'
import { parse, serialize } from '../collapse/utils/sexpr.js'
import { renderBinaryTreeScene } from './binary-tree-scene.js'
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
  const nextTrace = !trace && pair !== null ? traceCollapse(pair) : null
  const isStable = !!nextTrace && !nextTrace.changed
  const shownPair = currentFrame?.term ?? pair
  const treePanelKey = shownPair === null
    ? 'empty'
    : `${serialize(shownPair)}:${currentFrame?.path ?? 'none'}:${currentFrame?.type ?? 'idle'}`

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

  const tree = renderBinaryTreeScene(shownPair, currentFrame)

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
          reduceLabel: trace ? 'Next' : isStable ? 'Stable' : 'Reduce',
          canUndo: !!trace || history.length > 0,
          status: currentFrame ? describeTrace(currentFrame) : null }),
      div({ class: 'panel', key: treePanelKey }, tree)))
})

export default () => div({ class: 'collapse-demo-root' }, View())
