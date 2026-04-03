import { button, component, div, h2, label, p, pre, textarea } from '@pfern/elements'
import { parse, resolve } from '../sexpr.js'
import DEFAULT_SOURCE_TEXT from '../source.lisp?raw'
import './style.css'
import { collapse } from '../collapse.js'

export const DEFAULT_SOURCE = DEFAULT_SOURCE_TEXT

// One reduction "tick" in the UI: one leftmost-outermost resolve step, then one
// leftmost-outermost collapse step (`(() x) -> x`).
const step = pair => collapse(resolve(pair))

const state = source => {
  try {
    const next = parse(source)
    return { source,
             pair: next,
             error: null,
             history: [],
             stable: false }
  } catch (error) {
    return { source,
             pair: null,
             error: String(error?.message || error),
             history: [],
             stable: false }
  }
}

const load = (view, source) => view(state(source))

export const dashboard = ({
  title,
  hint,
  kind = null,
  scene
}) => {
  const initial = state(DEFAULT_SOURCE)
  let view

  view = component(({
    source = DEFAULT_SOURCE,
    pair = initial.pair,
    error = null,
    history = [],
    stable = false
  } = {}) => {
    const classes = ['dashboard', kind].filter(Boolean).join(' ')
    const hintContent = Array.isArray(hint) ? hint : [hint]

    const reduce = () => {
      if (stable || !Array.isArray(pair)) return

      const next = step(pair)
      return next === pair
        ? view({
          source,
          pair,
          error: null,
          history,
          stable: true
        })
        : view({
          source,
          pair: next,
          error: null,
          history: [...history, pair],
          stable: false
        })
    }

    const undo = () =>
      !history.length
        ? undefined
        : view({
          source,
          pair: history[history.length - 1],
          error: null,
          history: history.slice(0, -1),
          stable: false
        })

    return div(
      { class: classes },
      div({ class: 'panel' },
          h2(title),
          p({ class: 'hint' }, ...hintContent),

          label('Program / expression',
                textarea({ value: source,
                           onchange: value => load(view, String(value ?? '')),
                           spellcheck: false })),

          div({ class: 'row' },
              button({ onclick: () => load(view, DEFAULT_SOURCE) },
                     'Reset'),
              button({ onclick: reduce, disabled: !!error || stable },
                     stable ? 'Stable' : 'Reduce'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),

          div({ class: 'hint' }, `Steps: ${history.length}`),
          error ? pre({ class: 'expr' }, `Error: ${error}`) : null),

      div({ class: 'panel' },
          div({ class: 'scene' }, scene(pair))))
  })

  return view
}
