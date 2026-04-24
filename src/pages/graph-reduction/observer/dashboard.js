import { button, component, div, h2, label, p, textarea } from '@pfern/elements'
import { compile } from '../graph/index.js'
import DEFAULT_SOURCE from '../source.lisp?raw'
import '../visualizations/style.css'
import { observe } from './observe.js'

/**
 * @module dashboard
 *
 * Interactive host for stepping pair graphs in the browser.
 */

/**
 * Wraps a scene renderer with a source editor and step controls.
 *
 * The dashboard currently owns "observer time" state such as history and focus.
 * This keeps `observe` pure and pair-local while still letting the UI replay
 * snapshots, undo, and reset.
 *
 * @typedef {(graph: unknown, sequence: unknown[], witness: unknown[]) => unknown} Scene
 * @typedef {{
 *   className: string,
 *   title: string,
 *   description: string,
 *   scene: Scene
 * }} DashboardOptions
 *
 * @param {DashboardOptions} options
 * @returns {Function}
 */
export default ({ className, title, description, scene }) => {
  // The dashboard carries source text, serialization inputs, graph history,
  // and observer time. The observer itself stays a pure graph step.
  const dashboard = component(({
    source = DEFAULT_SOURCE,
    graph: initialGraph = compile(source),
    sequence: initialSequence = null,
    witness: initialWitness = null,
    history = []
  } = {}) => {
    const state = initialGraph?.graph
      ? initialGraph
      : { graph: initialGraph,
          sequence: initialSequence ?? [],
          witness: initialWitness ?? [] }
    const { graph: focus, sequence, witness = [] } = state
    const time = history.length
    const previous = history[time - 1]
    const error =
      typeof focus === 'object' && !Array.isArray(focus) && String(focus)

    const stable = !!time && previous?.graph === focus

    const view = () =>
      dashboard({ source,
                  graph: observe(focus),
                  sequence,
                  witness,
                  history: [...history, state] })

    const undo = () =>
      dashboard({ source,
                  graph: previous?.graph,
                  sequence: previous?.sequence,
                  witness: previous?.witness,
                  history: history.slice(0, -1) })

    const reset = () => dashboard({ source: DEFAULT_SOURCE })

    return div(
      { class: `dashboard ${className}` },
      div({ class: 'panel' },
          h2(title),
          p({ class: 'description' }, description),

          label('Program / expression',
                textarea({ value: source,
                           onchange: value =>
                             dashboard({
                               source: value,
                               graph: compile(value)
                             }),
                           spellcheck: false })),

          div({ class: 'row' },
              button({ onclick: view, disabled: stable || !!error },
                     stable ? 'Stable' : 'Next'),
              button({ onclick: undo, disabled: time === 0 }, 'Undo'),
              button({ onclick: reset }, 'Reset')),

          div({ class: 'description' }, `Steps: ${time}`)),

      div({ class: 'panel scene' }, error || scene(focus, sequence, witness)))
  })

  return dashboard
}
