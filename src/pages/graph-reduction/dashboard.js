import './style.css'
import {
  button,
  component,
  div,
  h2,
  label,
  option,
  p,
  pre,
  select as menu,
  span,
  textarea
} from '@pfern/elements'
import {
  compile,
  identityCount,
  identitySchemes,
  identityStyle,
  observe,
  serialize,
  serializeParts
} from './graph.js'
import lisp from './core.lisp?raw'

const schemeNames = ['ink', 'pastel', 'color', 'plain']

const graphOutput = (graph, scheme) => {
  const parts = serializeParts(graph)
  const count = identityCount(parts)
  const children = parts.map(part =>
    part.identity === undefined
      ? part.text
      : span(
        { class: 'identity',
          style: identityStyle(part.identity, scheme, count) },
        part.text))

  return pre({ class: 'output' }, ...children)
}

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
  (state = { ...build(lisp), source: lisp, history: [], scheme: 'ink' }) => {

    const { graph, source, history, error, scheme } = state
    const { time, previous, stable } = infer(state)

    const view = () => dashboard(
      { ...state,
        graph: observe(graph, g => console.log(serialize(g))),
        history: [...history, state] })

    const load = source => dashboard(
      { ...state, ...build(source), source, history: [] })

    const chooseScheme = scheme => dashboard({ ...state, scheme })

    const undo = () => dashboard({ ...previous, scheme })

    const reset = () => dashboard({ ...history[0], scheme })

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

          label(
            'Scheme',
            menu(
              { value: scheme, onchange: chooseScheme },
              ...schemeNames
                .filter(name => identitySchemes[name])
                .map(name => option({ value: name }, name)))),

          div({ class: 'description' }, `Steps: ${time}`)),
      div(
        { class: 'panel scene' },
        error
          ? pre({ class: 'output error' }, String(error))
          : graphOutput(graph, scheme)))
  })

export default dashboard
