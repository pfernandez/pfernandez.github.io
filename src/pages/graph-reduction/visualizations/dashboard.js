import { component, div } from '@pfern/elements'
import { layout } from '../layout.js'
import { observe } from '../observe.js'
import { parse } from '../sexpr.js'
import { DEFAULT_SOURCE, panel } from './panel.js'
import './style.css'

const describe = event => `Collapse at ${event.path}`
const frame = pair => pair === null ? null : layout(pair)

const read = (view, source) => {
  try {
    const pair = parse(source)
    return view({ source, pair, frame: frame(pair), error: null, history: [] })
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
      panel(
        { title,
          hint,
          source,
          history,
          error,
          onSource: source => read(view, source),
          onReset: () => read(view, DEFAULT_SOURCE),
          onReduce: step,
          onUndo: undo,
          reduceLabel: stable ? 'Stable' : 'Reduce',
          canUndo: history.length > 0,
          status: event ? describe(event) : null }),
      div(
        panelKey === null
          ? { class: 'panel' }
          : { class: 'panel', key: panelKey(pair, event) },
        div({ class: 'scene' }, scene(pair, event, sceneFrame))))
  })

  return view
}
