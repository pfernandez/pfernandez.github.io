import {
  link,
  serializeAnsi,
  step
} from './graph/index.js'

let traceCount = 0

const traceScheme = () =>
  process.env.GRAPH_SCHEME || 'color'

const trace = (form, legend) =>
  console.log(
    traceCount++,
    serializeAnsi(form, { legend, scheme: traceScheme() }),
    '\n')

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const [first, second] = process.argv.slice(2)
  const isCount = value => /^\d+$/.test(value)
  const file = first && !isCount(first)
    ? first
    : new URL('./core.graph.lisp', import.meta.url)
  const count = Number(isCount(first) ? first : (second ?? 3))
  const { graph, legend, error } = link(readFileSync(file, 'utf-8'))
  if (error) throw error

  let focus = graph
  for (let i = 0; i < count; i++) {
    trace(focus, legend)
    focus = step(focus)
  }
}
