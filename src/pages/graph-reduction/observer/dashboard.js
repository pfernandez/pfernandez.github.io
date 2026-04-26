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

const infer = (
  { graph,
    history,
    time = history.length,
    previous = history[time - 1],
    stable = previous?.graph === graph }) => ({ time, previous, stable })

const dashboard = component(state => {
  const { graph, source, history, error, options } = state
  const { className, title, description, scene } = options
  const { time, previous, stable } = infer(state)

  const view = () =>
    dashboard({ ...state, graph: observe(graph), history: [...history, state] })
  const load = source => dashboard({ ...state, ...compile(source), source })
  const undo = () => dashboard(previous)
  const reset = () => dashboard(history[0])

  return div(
    { class: `dashboard ${className}` },
    div({ class: 'panel' },
        h2(title),
        p({ class: 'description' }, description),

        label('Program / expression',
              textarea({ value: source, onchange: load, spellcheck: false })),

        div({ class: 'row' },
            button({ onclick: view, disabled: stable || error },
                   stable ? 'Stable' : 'Next'),
            button({ onclick: undo, disabled: time === 0 }, 'Undo'),
            button({ onclick: reset, disabled: time === 0 }, 'Reset')),

        div({ class: 'description' }, `Steps: ${time}`)),
    div({ class: 'panel scene' }, error || scene(state)))
})

/**
 * Wraps a scene renderer with a source editor and step controls.
 *
 * The dashboard currently owns "observer time" state such as the history and
 * graph. This keeps `observe` pure and pair-local while still letting the UI
 * replay snapshots, undo, and reset.
 *
 * @typedef {*} State
 * @typedef {(State) => any} Scene
 * @typedef
 * {{ className: string, title: string, description: string, scene: Scene }}
 * DashboardOptions
 *
 * @param {DashboardOptions} options
 * @returns {Function}
 */
export default options => () => dashboard(
  { ...compile(DEFAULT_SOURCE),
    source: DEFAULT_SOURCE,
    history: [],
    options })

