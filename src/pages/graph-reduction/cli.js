import {
  depth,
  event,
  link,
  serializeAnsi,
  step,
  tick
} from './graph/index.js'

let traceCount = 0

const traceScheme = () =>
  process.env.GRAPH_SCHEME || 'color'

const trace = (form, legend, label = traceCount++) =>
  console.log(
    label,
    serializeAnsi(form, { legend, scheme: traceScheme() }),
    '\n')

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const args = process.argv.slice(2)
  const events = args.includes('--events')
  const [first, second] = args.filter(arg => arg !== '--events')
  const isCount = value => /^\d+$/.test(value)
  const file = first && !isCount(first)
    ? first
    : new URL('./core.graph.lisp', import.meta.url)
  const count = Number(isCount(first) ? first : (second ?? 3))
  const { graph, legend, error } = link(readFileSync(file, 'utf-8'))
  if (error) throw error

  let focus = events ? event(graph) : graph
  for (let i = 0; i < count; i++) {
    if (events) {
      trace(focus[0], legend, `${traceCount++} h=${depth(focus)}`)
      tick(focus)
    } else {
      trace(focus, legend)
      focus = step(focus)
    }
  }
}
