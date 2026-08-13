import './style.css'
import { button, component, div, label, select as menu, option, p, pre,
         textarea } from '@pfern/elements'
import { view } from './device.js'
import { link, schemeNames, schemes, serialize, step } from './graph/index.js'
import lisp from './observe.lisp?raw'
import dashboardLisp from './dashboard.lisp?raw'

const heading = view(dashboardLisp)

const initialState =
  { ...link(lisp), source: lisp, history: [], scheme: schemes.ink }

const infer = (
  { focus,
    error,
    history,
    time = history.length,
    previous = history[time - 1],
    stable = error || step(focus) === focus }) => ({ time, previous, stable })

const dashboard = component(
  (state = initialState) => {
    const { focus, source, history, error, scheme } = state
    const { time, previous, stable } = infer(state)
    const [current] = focus

    const view = () =>
      dashboard({ ...state, focus: step(focus), history: [...history, state] })
    const load = source =>
      dashboard({ ...state, ...link(source), source, history: [] })
    const chooseScheme = scheme => dashboard({ ...state, scheme })
    const undo = () => dashboard({ ...previous, scheme })
    const reset = () => dashboard({ ...history[0], scheme })

    return div(
      { class: 'dashboard' },
      div({ class: 'panel' },
          heading,
          p({ class: 'description' },
            'The expression defines an observer whose left side is its ',
            'current state and whose right side is its next state. ',
            'Symbols and colors denote memory address'),

          label({ class: 'row colors' }, 'Color scheme',
                menu({ value: scheme, onchange: chooseScheme },
                     ...schemeNames
                       .map(name => option({ value: name }, name))))),

      div({ class: 'panel scene' },
          label({ class: 'row' },
                'Expression',
                textarea({ value: source, onchange: load, spellcheck: false })),

          div({ class: 'row' },
              button({ onclick: view, disabled: stable || error },
                     stable ? 'Stable' : 'Next'),
              button({ onclick: undo, disabled: time === 0 }, 'Undo'),
              button({ onclick: reset, disabled: time === 0 }, 'Reset')),

          label({ class: 'row output' },
                'Result',
                error ? pre({ class: 'error' }, String(error))
                  : serialize(current, { format: 'vdom', scheme })),

          div({ class: 'description row' }, `Steps: ${time}`)))
  })

export default dashboard
