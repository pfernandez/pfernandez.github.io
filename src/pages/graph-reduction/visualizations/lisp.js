import { article, component, div, section } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { collapse } from '../collapse/index.js'
import { parse } from '../collapse/utils/sexpr.js'
import './lisp.css'

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => readSource(View, source)

const renderPair = (pair, depth = 0) =>
  Array.isArray(pair)
    ? pair.length === 0
      ? '()'
      : `(${renderPair(pair[0], depth + 1)} ${renderPair(pair[1], depth + 1)})`
    : pair

const View = component((
  { source = DEFAULT_SOURCE,
    pair = initialPair,
    error = null,
    history = []} = {}) => {

  // TBD: Stepping works well but obscures the physical nature of the collapse
  // event, which itself generates both time and space. It is possible to
  // somehow watch the evolution of the pair in a more hands-off way, perhaps
  // pausing recursion with each click? In other words, collapse should
  // drive the animation, and the view should simply view it.
  const step = () => View(
    { source,
      pair: collapse(pair),
      error: null,
      history: [...history, pair]})

  const undo = () => history.length && View(
    { source,
      pair: history[history.length - 1],
      error: null,
      history: history.slice(0, -1) })

  return article(
    section({ class: 'lisp-view' },

            controlsPanel(
              { title: 'S-expressions',
                hint: [''],
                source,
                history,
                error,
                onSource: setSource,
                onReset: () => setSource(DEFAULT_SOURCE),
                onStep: step,
                onUndo: undo }),

            div({ class: 'panel lisp-panel' },
                div({ class: 'lisp-scene' }, renderPair(pair)))))
})

export default () => div({ class: 'lisp-root' }, View())

