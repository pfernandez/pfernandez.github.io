import './style.css'
import { button, component, div, h2, label, p, textarea } from '@pfern/elements'
import { compile, observe, select, serialize } from './graph.js'
import lisp from './core.lisp?raw'

// One step: observe walks to the answer cell, select reads what it holds.
const step = (graph, trace) =>
  select(observe(graph, trace))

const build = source => {
  let graph = [], error
  try { graph = compile(source) }
  catch (e) { error = e }
  return { graph, error }
}

// Derived state: the step count, where undo leads, and whether stepping
// would change anything.
const infer = (
  { graph,
    history,
    error,
    time = history.length,
    previous = history[time - 1],
    stable = !error && step(graph) === graph }) => ({ time, previous, stable })

const dashboard = component(
  (state = { ...build(lisp), source: lisp, history: [] }) => {

    const { graph, source, history, error } = state
    const { time, previous, stable } = infer(state)

    const view = () => dashboard(
      { ...state,
        graph: step(graph, g => console.log(serialize(g))),
        history: [...history, state] })

    const load = source => dashboard(
      { ...state, ...build(source), source, history: [] })

    const undo = () => dashboard(previous)

    const reset = () => dashboard(history[0])

    return div(
      { class: 'dashboard' },
      div({ class: 'panel' },
          h2('Graph Reduction'),
          p({ class: 'description' },
            'Expressions are converted directly to graph structure.'),

          label('Program / expression',
                textarea({ value: source, onchange: load, spellcheck: false })),

          div({ class: 'row' },
              button({ onclick: view, disabled: stable || error },
                     stable ? 'Stable' : 'Next'),
              button({ onclick: undo, disabled: time === 0 }, 'Undo'),
              button({ onclick: reset, disabled: time === 0 }, 'Reset')),

          div({ class: 'description' }, `Steps: ${time}`)),
      div({ class: 'panel scene' }, error || serialize(graph)))
  })

export default dashboard
