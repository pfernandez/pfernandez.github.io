import { button, component, div, h2, label, p, textarea } from '@pfern/elements'
import { compile } from '../sexpr.js'
import DEFAULT_SOURCE from '../source.lisp?raw'
import './style.css'
import { observe } from '../observe.js'

export default ({ className, title, description, scene }) => {
  // The dashboard is the host-side observer for now: it carries focus,
  // history, and observer time until those can be represented as pair motifs.
  const dashboard = component(({
    source = DEFAULT_SOURCE,
    graph = compile(source),
    history = []
  } = {}) => {
    const focus = graph
    const time = history.length
    const previous = history[time - 1]
    const error =
      typeof focus === 'object' && !Array.isArray(focus) && String(focus)

    const stable = !!time && previous === focus

    const view = () =>
      dashboard({ source,
                  graph: observe(focus),
                  history: [...history, focus] })

    const undo = () =>
      dashboard({ source,
                  graph: previous,
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

      div({ class: 'panel scene' }, error || scene(focus)))
  })

  return dashboard
}
