import { button, component, div, h2, label, p, textarea } from '@pfern/elements'
import { buildOne, parseProgram } from '../sexpr.js'
import DEFAULT_SOURCE from '../source.lisp?raw'
import './style.css'
import { observe } from '../observe.js'

const hasSlots = node =>
  (typeof node === 'number' && Number.isInteger(node) && node >= 0)
  || (Array.isArray(node) && node.length === 2
      && (hasSlots(node[0]) || hasSlots(node[1])))

const step = graph => hasSlots(graph) ? buildOne(graph) : observe(graph)

export default ({ className, title, description, scene }) => {
  const dashboard = component(({
    source = DEFAULT_SOURCE,
    graph = parseProgram(source),
    history = []
  } = {}) => {
    const error =
      typeof graph === 'object' && !Array.isArray(graph) && String(graph)

    const stable = !!history.length && history[history.length - 1] === graph

    const view = () =>
      dashboard({ source, graph: step(graph), history: [...history, graph] })

    const undo = () =>
      dashboard({ source,
                  graph: history[history.length - 1],
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
                               graph: parseProgram(value)
                             }),
                           spellcheck: false })),

          div({ class: 'row' },
              button({ onclick: view, disabled: stable || !!error },
                     stable ? 'Stable' : 'Next'),
              button({ onclick: undo, disabled: history.length === 0 }, 'Undo'),
              button({ onclick: reset }, 'Reset')),

          div({ class: 'description' }, `Steps: ${history.length}`)),

      div({ class: 'panel scene' }, error || scene(graph)))
  })

  return dashboard
}
