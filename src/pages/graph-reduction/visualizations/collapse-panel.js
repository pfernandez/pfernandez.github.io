import { button, div, h2, label, p, pre, textarea } from '@pfern/elements'
import { parse } from '../collapse/utils/sexpr.js'

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
    onSource, onReset, onStep, onUndo }) =>

  div({ class: 'panel' },
      h2(title),
      p({ class: 'hint' }, ...children(hint)),
      label('Program / term',
            textarea({ value: source,
                       onchange: value => onSource(String(value ?? '')),
                       spellcheck: false })),

      div({ class: 'row' },
          button({ onclick: onReset }, 'Reset'),
          button({ onclick: onStep, disabled: !!error }, 'Reduce'),
          button({ onclick: onUndo, disabled: history.length === 0 }, 'Undo')),

      div({ class: 'hint' }, `Steps: ${history.length}`),
      error ? pre({ class: 'expr' }, `Error: ${error}`) : null)

