import { article, button, component, div, h2, label, p, pre, section,
         span, textarea } from '@pfern/elements'
import { collapse } from './collapse/index.js'
import { parse, serialize } from './collapse/utils/sexpr.js'
import './lisp.css'

const DEFAULT_SOURCE =
`; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x

((() ()) (() (a b)))`

const initialPair = parse(DEFAULT_SOURCE)

const setSource = source => {
  try {
    return View({ source, pair: parse(source), error: null, history: []})
  } catch (e) {
    return View({ source, pair: null, error: String(e?.message || e), history: []})
  }
}

const spanWidth = pair =>
  Array.isArray(pair)
    ? pair.length === 0
      ? 2
      : spanWidth(pair[0]) + spanWidth(pair[1]) + 3
    : String(pair).length

const viewStyle = (pair, depth) => ({
  '--depth': depth,
  '--span': spanWidth(pair),
  '--ink-alpha': Math.max(0.32, 0.94 - depth * 0.09).toFixed(2)
})

const renderPair = (pair, depth = 0) =>
  Array.isArray(pair)
    ? pair.length === 0
      ? span({ class: 'lisp-leaf empty', style: viewStyle(pair, depth) }, '()')
      : span(
        { class: 'lisp-pair', style: viewStyle(pair, depth) },
        span({ class: 'lisp-child left' }, renderPair(pair[0], depth + 1)),
        span({ class: 'lisp-space' }, ' '),
        span({ class: 'lisp-child right' }, renderPair(pair[1], depth + 1)))
    : span({ class: 'lisp-leaf atom', style: viewStyle(pair, depth) }, String(pair))

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

    return View({
      source,
      pair: after,
      error: null,
      history: [...history, pair]
    })
  }

  const undo = () => history.length && View(
    { source,
      pair: history[history.length - 1],
      error: null,
      history: history.slice(0, -1) })

  const text = pair !== null ? serialize(pair) : null

  return article(
    section(
      { class: 'lisp-view' },
      div({ class: 'panel' },
          h2('Lisp view'),
          p({ class: 'hint' },
            'The pair is rendered as nested DOM. Width follows printed span; ',
            'the visible grouping comes ',
            'from CSS, not a coordinate layout pass.'),
          label('Program / term',
                textarea(
                  { value: source,
                    oninput: value =>
                      setSource(String(value ?? '')),
                    spellcheck: false })),
          div({ class: 'row' },
              button({ onclick: () => setSource(DEFAULT_SOURCE) }, 'Reset'),
              button({ onclick: collapseNow, disabled: !!error }, 'Collapse'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),
          div({ class: 'hint', style: { marginTop: '8px' }},
              `Collapses: ${history.length}`),
          error ? pre({ class: 'expr' }, error) : null,
          text ? div(
            div({ class: 'hint', style: { marginTop: '10px' }}, 'Current'),
            pre({ class: 'expr' }, text))
            : null),
      div({ class: 'panel lisp-panel' },
          pair !== null
            ? div({ class: 'lisp-scene' }, renderPair(pair))
            : pre('Parse an expression to view it.'))))
})

export default () => div({ class: 'lisp-root' }, View())
