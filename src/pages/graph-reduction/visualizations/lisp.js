import { article, component, div, section } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { collapse } from '../collapse/index.js'
import { parse, serialize } from '../collapse/utils/sexpr.js'
import './lisp.css'

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => readSource(View, source)

const View = component((
  { source = DEFAULT_SOURCE,
    pair = initialPair,
    error = null,
    history = []} = {}) => {

  // TODO: Expose the reducer as a trace so the view can watch descent,
  // collapse, and rebuild instead of triggering those steps itself.
  const step = () => {
    const nextPair = collapse(pair)

    if (nextPair === pair) return

    return View(
      { source,
        pair: nextPair,
        error: null,
        history: [...history, pair]})
  }

  const undo = () => history.length && View(
    { source,
      pair: history[history.length - 1],
      error: null,
      history: history.slice(0, -1) })

  return article(
    section({ class: 'lisp-view' },

            controlsPanel(
              { title: 'S-expressions',
                hint: 'The same reducer as the tree view, rendered as a term.',
                source,
                history,
                error,
                onSource: setSource,
                onReset: () => setSource(DEFAULT_SOURCE),
                onReduce: step,
                onUndo: undo }),

            div({ class: 'panel lisp-panel' },
                div({ class: 'lisp-scene' }, pair === null ? null : serialize(pair)))))
})

export default () => div({ class: 'lisp-root' }, View())
