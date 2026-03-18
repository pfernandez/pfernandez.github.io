import { article, component, div, pre, section, span } from '@pfern/elements'
import { DEFAULT_SOURCE, controlsPanel, readSource } from './collapse-panel.js'
import { collapse } from '../collapse/index.js'
import { parse } from '../collapse/utils/sexpr.js'
import './lisp.css'

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => readSource(View, source)

const viewStyle = depth =>
  ({ '--ink-alpha': Math.max(0.32, 0.94 - depth * 0.09).toFixed(2) })

const renderPair = (pair, depth = 0) =>
  Array.isArray(pair)
    ? pair.length === 0
      ? span({ class: 'lisp-leaf empty', style: viewStyle(depth) }, '()')
      : span(
        { class: 'lisp-pair', style: viewStyle(depth) },
        span({ class: 'lisp-child left' }, renderPair(pair[0], depth + 1)),
        ' ',
        span({ class: 'lisp-child right' }, renderPair(pair[1], depth + 1)))
    : span({ class: 'lisp-leaf leaf', style: viewStyle(depth) }, String(pair))

const View = component(({
  source = DEFAULT_SOURCE,
  pair = initialPair,
  error = null,
  history = []
} = {}) => {
  const collapseNow = () => {
    if (pair === null) return

    const after = collapse(pair)

    if (after === pair) return

    return View(
      { source,
        pair: after,
        error: null,
        history: [...history, pair]})
  }

  const undo = () => history.length && View(
    { source,
      pair: history[history.length - 1],
      error: null,
      history: history.slice(0, -1) })

  return article(
    section(
      { class: 'lisp-view' },
      controlsPanel(
        { title: 'Lisp view',
          hint:
          ['The pair is rendered as nested DOM; the visible grouping comes ',
           'from CSS, not a coordinate layout pass.'],
          source,
          history,
          error,
          onSource: setSource,
          onReset: () => setSource(DEFAULT_SOURCE),
          onCollapse: collapseNow,
          onUndo: undo }),
      div({ class: 'panel lisp-panel' },
          pair !== null
            ? div({ class: 'lisp-scene' }, renderPair(pair))
            : pre('Parse an expression to view it.'))))
})

export default () => div({ class: 'lisp-root' }, View())
