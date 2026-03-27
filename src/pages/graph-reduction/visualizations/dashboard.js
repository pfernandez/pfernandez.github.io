import { button, component, div, h2, label, p, pre, textarea } from '@pfern/elements'
import { layout } from '../layout.js'
import { build, collapse, materialize } from '../links.js'
import { parse } from '../sexpr.js'
import DEFAULT_SOURCE_TEXT from '../source.lisp?raw'
import './style.css'

export const DEFAULT_SOURCE = DEFAULT_SOURCE_TEXT

const describe = event => `Collapse at ${event.path}`
const frame = pair => layout(pair)

const read = source => {
  const model = build(parse(source))
  const pair = materialize(...model)
  return { model, pair }
}

const step = model => {
  let event = null
  const next = collapse(...model, note => {
    event = note
  })

  return { model: next,
           pair: materialize(...next),
           changed: next[0] !== model[0] || next[1] !== model[1],
           event }
}

const state = source => {
  try {
    const next = read(source)
    return { source,
             model: next.model,
             pair: next.pair,
             frame: frame(next.pair),
             error: null,
             history: [] }
  } catch (error) {
    return { source,
             model: null,
             pair: null,
             frame: null,
             error: String(error?.message || error),
             history: [] }
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
    model = initial.model,
    pair = initial.pair,
    frame: sceneFrame = initial.frame,
    error = null,
    history = [],
    event = null
  } = {}) => {
    const observation = model === null ? null : step(model)
    const stable = !!observation && !observation.changed
    const classes = ['dashboard', kind].filter(Boolean).join(' ')
    const hintContent = Array.isArray(hint) ? hint : [hint]

    const reduce = () =>
      pair === null || !observation?.changed
        ? undefined
        : view({
          source,
          model: observation.model,
          pair: observation.pair,
          frame: sceneFrame,
          error: null,
          history: [...history, { model, pair }],
          event: observation.event
        })

    const undo = () =>
      !history.length
        ? undefined
        : view({
          source,
          model: history[history.length - 1].model,
          pair: history[history.length - 1].pair,
          frame: sceneFrame,
          error: null,
          history: history.slice(0, -1),
          event: null
        })

    return div(
      { class: classes },
      div(
        { class: 'panel' },
        h2(title),
        p({ class: 'hint' }, ...hintContent),
        label('Program / expression',
              textarea({ value: source,
                         onchange: value => load(view, String(value ?? '')),
                         spellcheck: false })),
        div(
          { class: 'row' },
          button({ onclick: () => load(view, DEFAULT_SOURCE) }, 'Reset'),
          button({ onclick: reduce, disabled: !!error || !observation?.changed },
                 stable ? 'Stable' : 'Reduce'),
          button({ onclick: undo, disabled: history.length === 0 }, 'Undo')),
        div({ class: 'hint' }, `Steps: ${history.length}`),
        event ? div({ class: 'hint expr' }, describe(event)) : null,
        error ? pre({ class: 'expr' }, `Error: ${error}`) : null),
      div(
        { class: 'panel' },
        div({ class: 'scene' }, scene(pair, event, sceneFrame, model))))
  })

  return view
}
