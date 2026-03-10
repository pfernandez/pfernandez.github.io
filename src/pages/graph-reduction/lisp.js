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

const ink = depth => ({
  '--depth': depth,
  '--ink-alpha': Math.max(0.32, 0.94 - depth * 0.09).toFixed(2)
})

const renderPair = (pair, depth = 0) =>
  Array.isArray(pair)
    ? pair.length === 0
      ? span({ class: 'lisp-leaf empty', style: ink(depth) }, '()')
      : span(
        { class: 'lisp-pair', style: ink(depth) },
        span({ class: 'lisp-child left' }, renderPair(pair[0], depth + 1)),
        span({ class: 'lisp-child right' }, renderPair(pair[1], depth + 1)))
    : span({ class: 'lisp-leaf atom', style: ink(depth) }, String(pair))

const View = component(({
  source = DEFAULT_SOURCE,
  pair = initialPair,
  error = null,
  history = []
} = {}) => {
  const next = pair !== null ? collapse(pair) : null

  const stepOnce = () => {
    if (pair === null) return View({ source, pair, error, history })

    return next !== null
      ? View({
        source,
        pair: next,
        error: null,
        history: [...history, pair]
      })
      : View({ source, pair, error: null, history })
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
            'The pair is rendered as nested DOM. The visible grouping comes ',
            'from CSS, not a coordinate layout pass.'),
          label('Program / term',
                textarea(
                  { value: source,
                    oninput: value =>
                      setSource(String(value ?? '')),
                    spellcheck: false })),
          div({ class: 'row' },
              button({ onclick: () => setSource(DEFAULT_SOURCE) }, 'Reset'),
              button({ onclick: stepOnce, disabled: !!error }, 'Step'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),
          div({ class: 'hint', style: { marginTop: '8px' }},
              `Steps: ${history.length}`,
              next !== null ? ' · Reducible' : ' · Stuck'),
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
