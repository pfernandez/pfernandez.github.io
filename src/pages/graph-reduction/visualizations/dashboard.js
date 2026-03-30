import { button, component, div, h2, label, p, pre, textarea } from '@pfern/elements'
import { parse } from '../sexpr.js'
import DEFAULT_SOURCE_TEXT from '../source.lisp?raw'
import './style.css'
import { collapse } from '../collapse.js'

export const DEFAULT_SOURCE = DEFAULT_SOURCE_TEXT

const describe = event => `Collapse at ${event.path}`

const step = pair => {
  const next = collapse(pair)

  console.log({ pair, next })

  return { pair: next,
           changed: next !== pair }
}

const state = source => {
  try {
    const next = parse(source)
    return { source,
             pair: next,
             error: null,
             history: []}
  } catch (error) {
    return { source,
             pair: null,
             error: String(error?.message || error),
             history: []}
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
    event = null
  } = {}) => {

    const observation = pair === null ? null : step(pair)
    const stable = !!observation && !observation.changed
    const classes = ['dashboard', kind].filter(Boolean).join(' ')
    const hintContent = Array.isArray(hint) ? hint : [hint]

    const reduce = () =>
      pair === null || !observation?.changed
        ? undefined
        : view({
          source,
          pair: observation.pair,
          error: null,
          history: [...history, pair],
          event: observation.event
        })

    const undo = () =>
      !history.length
        ? undefined
        : view({
          source,
          pair: history[history.length - 1].pair,
          error: null,
          history: history.slice(0, -1),
          event: null
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
              button({ onclick: reduce,
                       disabled: !!error || !observation?.changed },
                     stable ? 'Stable' : 'Reduce'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),

          div({ class: 'hint' }, `Steps: ${history.length}`),
          event ? div({ class: 'hint expr' }, describe(event)) : null,
          error ? pre({ class: 'expr' }, `Error: ${error}`) : null),

      div({ class: 'panel' },
          div({ class: 'scene' }, scene(pair, event))))
  })

  return view
}
