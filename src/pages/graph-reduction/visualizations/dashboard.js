import { button, component, div, h2, label, p, textarea } from '@pfern/elements'
import { build, parse } from '../sexpr.js'
import DEFAULT_SOURCE from '../source.lisp?raw'
import './style.css'
import { observe } from '../observe.js'

export default ({ className, title, description, scene }) => {
  const dashboard = component(({
    source = DEFAULT_SOURCE,
    pair = parse(source),
    history = []
  } = {}) => {
    const last = history.length && history[history.length - 1]
    const stable = last === pair
    const error =
      typeof pair === 'object' && !Array.isArray(pair) && String(pair)

    const undo = () =>
      last && dashboard({ source, pair: last, history: history.slice(0, -1) })

    const next = () => {
      if (!stable) {
        console.log(JSON.stringify(pair))
        const motif = build(pair)
        console.log(JSON.stringify(motif))
        const result = observe(motif).after
        console.log(JSON.stringify(result))

        return dashboard({ source, pair: result, history: [...history, pair] })
      }
    }

    return div(
      { class: `dashboard ${className}` },
      div({ class: 'panel' },
          h2(title),
          p({ class: 'description' }, description),

          label('Program / expression',
                textarea({ value: source,
                           onchange: value => dashboard({ source: value }),
                           spellcheck: false })),

          div({ class: 'row' },
              button({ onclick: () => dashboard({ source: DEFAULT_SOURCE }) },
                     'Reset'),
              button({ onclick: next, disabled: stable || !!error },
                     stable ? 'Stable' : 'Next'),
              button({ onclick: undo, disabled: history.length === 0 },
                     'Undo')),

          div({ class: 'description' }, `Steps: ${history.length}`)),

      div({ class: 'panel scene' }, error || scene(pair)))
  })

  return dashboard
}

