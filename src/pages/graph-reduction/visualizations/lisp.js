import { article, component, div, section, span } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { observe } from '../collapse/utils/observe.js'
import { parse } from '../collapse/utils/sexpr.js'
import './lisp.css'

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => readSource(View, source)

const renderPair = (pair, event = null, path = 'root') => {
  const content = Array.isArray(pair)
    ? pair.length === 0
      ? '()'
      : span('(',
             renderPair(pair[0], event, `${path}0`),
             ' ',
             renderPair(pair[1], event, `${path}1`),
             ')')
    : String(pair)

  if (!event || event.path !== path) return content

  return span({ class: 'lisp-focus lisp-focus-collapse' }, content)
}

const describeEvent = event => `Collapse at ${event.path}`

const View = component((
  { source = DEFAULT_SOURCE,
    pair = initialPair,
    error = null,
    history = [],
    event = null } = {}) => {
  const observation = pair === null ? null : observe(pair)
  const isStable = !!observation && !observation.changed

  const step = () => {
    if (pair === null || !observation?.changed) return

    return View(
      { source,
        pair: observation.after,
        error: null,
        history: [...history, pair],
        event: observation.event })
  }

  const undo = () => {
    return history.length && View(
      { source,
        pair: history[history.length - 1],
        error: null,
        history: history.slice(0, -1),
        event: null })
  }

  return article(
    section({ class: 'lisp-view' },

            controlsPanel(
              { title: 'S-expressions',
                hint: 'The same reducer as the tree view. Reduce performs one collapse event.',
                source,
                history,
                error,
                onSource: setSource,
                onReset: () => setSource(DEFAULT_SOURCE),
                onReduce: step,
                onUndo: undo,
                reduceLabel: isStable ? 'Stable' : 'Reduce',
                canUndo: history.length > 0,
                status: event ? describeEvent(event) : null }),

            div({ class: 'panel lisp-panel' },
                div({ class: 'lisp-scene' },
                    pair === null ? null : renderPair(pair, event)))))
})

export default () => div({ class: 'lisp-root' }, View())
