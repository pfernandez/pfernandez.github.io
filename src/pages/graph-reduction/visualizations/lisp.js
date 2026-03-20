import { article, component, div, section, span } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { traceCollapse } from '../collapse/index.js'
import { parse } from '../collapse/utils/sexpr.js'
import './lisp.css'

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => readSource(View, source)

const renderPair = (pair, frame = null, path = 'root') => {
  const content = Array.isArray(pair)
    ? pair.length === 0
      ? '()'
      : span('(',
             renderPair(pair[0], frame, `${path}0`),
             ' ',
             renderPair(pair[1], frame, `${path}1`),
             ')')
    : String(pair)

  if (!frame || frame.path !== path) return content

  const className = frame.type === 'collapse'
    ? 'lisp-focus lisp-focus-collapse'
    : 'lisp-focus'

  return span({ class: className }, content)
}

const describeTrace = frame =>
  ({ descend: `Trace: descend into ${frame.path}`,
     collapse: `Trace: collapse at ${frame.path}`,
     return: `Trace: return to ${frame.path}`,
     stable: `Trace: stable at ${frame.path}` }[frame.type])

const View = component((
  { source = DEFAULT_SOURCE,
    pair = initialPair,
    error = null,
    history = [],
    trace = null } = {}) => {
  const currentFrame = trace ? trace.frames[trace.index] : null
  const nextTrace = !trace && pair !== null ? traceCollapse(pair) : null
  const isStable = !!nextTrace && !nextTrace.changed
  const shownPair = currentFrame?.term ?? pair

  const step = () => {
    if (pair === null) return

    if (trace) {
      if (trace.index + 1 < trace.frames.length)
        return View({ source,
                      pair,
                      error: null,
                      history,
                      trace: { ...trace, index: trace.index + 1 }})

      return View(
        { source,
          pair: trace.after,
          error: null,
          history: trace.changed ? [...history, pair] : history,
          trace: null })
    }

    return View(
      { source,
        pair,
        error: null,
        history,
        trace: { ...nextTrace, index: 0 }})
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

  return article(
    section({ class: 'lisp-view' },

            controlsPanel(
              { title: 'S-expressions',
                hint: 'The same reducer as the tree view. Reduce opens a trace; Next advances it.',
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

            div({ class: 'panel lisp-panel' },
                div({ class: 'lisp-scene' },
                    shownPair === null ? null : renderPair(shownPair, currentFrame)))))
})

export default () => div({ class: 'lisp-root' }, View())
