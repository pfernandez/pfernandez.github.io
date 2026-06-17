import './style.css'
import {
  button,
  component,
  div,
  h2,
  label,
  p,
  pre,
  span,
  textarea
} from '@pfern/elements'
import { compile, observe, serialize, serializeColor } from './graph.js'
import lisp from './core.lisp?raw'

const ANSI_COLOR = /\x1b\[38;5;(\d+)m(.*?)\x1b\[0m/g

const ansiRgb = code => {
  const offset = Number(code) - 16
  const red = Math.floor(offset / 36)
  const green = Math.floor(offset / 6) % 6
  const blue = offset % 6
  return `rgb(${red * 51} ${green * 51} ${blue * 51})`
}

const spectrum = colors =>
  colors.length < 2
    ? colors[0] || 'transparent'
    : `linear-gradient(90deg, ${colors.join(', ')})`

const graphOutput = graph => {
  const output = serializeColor(graph)
  const children = []
  const colors = []
  const seenColors = new Set()
  let end = 0

  for (const match of output.matchAll(ANSI_COLOR)) {
    const color = ansiRgb(match[1])
    if (!seenColors.has(color)) {
      seenColors.add(color)
      colors.push(color)
    }

    if (match.index > end) children.push(output.slice(end, match.index))
    children.push(
      span(
        { class: 'identity', style: { color } },
        match[2]))
    end = match.index + match[0].length
  }

  if (end < output.length) children.push(output.slice(end))
  return div(
    { class: 'output-view' },
    div(
      { class: 'legend', 'aria-label': 'Cell color legend' },
      span({ class: 'legend-title' }, 'Cells'),
      span(
        { class: 'spectrum',
          style: { background: spectrum(colors) },
          title: `${colors.length} visible cell colors` }),
      span({ class: 'legend-more' }, String(colors.length))),
    pre({ class: 'output' }, ...children))
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
      div(
        { class: 'panel scene' },
        error
          ? pre({ class: 'output error' }, String(error))
          : graphOutput(graph)))
  })

export default dashboard
