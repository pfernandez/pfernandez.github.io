import { button, div, h2, label, p, pre, textarea } from '@pfern/elements'
import { parse } from '../sexpr.js'

export const DEFAULT_SOURCE =
`; Binary pairs only: () or (a b)
; Collapse rule: (() x) -> x

((() ()) (() (a b)))`

const children = content => Array.isArray(content) ? content : [content]

export const readSource = (View, source) => {
  try {
    return View({ source, pair: parse(source), error: null, history: []})
  } catch (e) {
    return View(
      { source, pair: null, error: String(e?.message || e), history: []})
  }
}

export const controlsPanel = (
  { title, hint, source, history, error,
    onSource, onReset, onReduce, onUndo,
    reduceLabel = 'Reduce',
    canUndo = history.length > 0,
    status = null }) =>

  div({ class: 'panel' },
      h2(title),
      p({ class: 'hint' }, ...children(hint)),
      label('Program / expression',
            textarea({ value: source,
                       onchange: value => onSource(String(value ?? '')),
                       spellcheck: false })),

      div({ class: 'row' },
          button({ onclick: onReset }, 'Reset'),
          button({ onclick: onReduce, disabled: !!error || !onReduce }, reduceLabel),
          button({ onclick: onUndo, disabled: !canUndo }, 'Undo')),

      div({ class: 'hint' }, `Steps: ${history.length}`),
      status ? div({ class: 'hint expr' }, status) : null,
      error ? pre({ class: 'expr' }, `Error: ${error}`) : null)
