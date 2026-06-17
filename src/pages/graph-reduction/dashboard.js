import './style.css'
import { button, component, div, h2, label, p, textarea } from '@pfern/elements'
import { compile, observe, serialize } from './graph.js'
import lisp from './core.lisp?raw'

const build = source => {
  let graph = [], error
  try { graph = compile(source) }
  catch (e) { error = e }
  return { graph, error }
}

const infer = (
  { graph,
    history,
    time = history.length,
    previous = history[time - 1],
    stable = graph === history[0] }) => ({ time, previous, stable })

const dashboard = component(
  (state = { ...build(lisp), source: lisp, history: [] }) => {

    const { graph, source, history, error } = state
    const { time, previous, stable } = infer(state)

    const view = () => dashboard(
      { ...state,
        graph: observe(graph, g => console.log(serialize(g))),
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
