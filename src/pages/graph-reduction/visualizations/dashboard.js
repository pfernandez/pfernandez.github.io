import { button, component, div, h2, label, p, pre, textarea } from '@pfern/elements'
import { layout } from '../layout.js'
import { observe } from '../observe.js'
import { parse } from '../sexpr.js'
import DEFAULT_SOURCE_TEXT from '../source.lisp?raw'
import './style.css'

export const DEFAULT_SOURCE = DEFAULT_SOURCE_TEXT

const describe = event => `Collapse at ${event.path}`
const frame = pair => pair === null ? null : layout(pair)

const read = (view, source) => {
  try {
    const pair = parse(source)
    return view({ source, pair, frame: frame(pair), error: null, history: []})
  } catch (error) {
    return view({
      source,
      pair: null,
      frame: null,
      error: String(error?.message || error),
      history: []
    })
  }
}

export const dashboard = (
  { title,
    hint,
    kind = null,
    panelKey = null,
    scene }) => {
  const initialPair = parse(DEFAULT_SOURCE)
  let view

  view = component(({
    source = DEFAULT_SOURCE,
    pair = initialPair,
    frame: sceneFrame = frame(initialPair),
    error = null,
    history = [],
    event = null
  } = {}) => {
    const observation = pair === null ? null : observe(pair)
    const stable = !!observation && !observation.changed
    const classes = ['dashboard', kind].filter(Boolean).join(' ')
    const hintContent = Array.isArray(hint) ? hint : [hint]

    const step = () =>
      pair === null || !observation?.changed
        ? undefined
        : view({
          source,
          pair: observation.after,
          frame: sceneFrame,
          error: null,
          history: [...history, pair],
          event: observation.event
        })

    const undo = () =>
      !history.length
        ? undefined
        : view({
          source,
          pair: history[history.length - 1],
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
                         onchange: value => read(view, String(value ?? '')),
                         spellcheck: false })),
        div(
          { class: 'row' },
          button({ onclick: () => read(view, DEFAULT_SOURCE) }, 'Reset'),
          button({ onclick: step, disabled: !!error || !observation?.changed },
                 stable ? 'Stable' : 'Reduce'),
          button({ onclick: undo, disabled: history.length === 0 }, 'Undo')),
        div({ class: 'hint' }, `Steps: ${history.length}`),
        event ? div({ class: 'hint expr' }, describe(event)) : null,
        error ? pre({ class: 'expr' }, `Error: ${error}`) : null),
      div(
        panelKey === null
          ? { class: 'panel' }
          : { class: 'panel', key: panelKey(pair, event) },
        div({ class: 'scene' }, scene(pair, event, sceneFrame))))
  })

  return view
}
