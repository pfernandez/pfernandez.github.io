import {
  compile,
  observe,
  select,
  serializeAnsi
} from './graph/index.js'

const traceScheme = () =>
  process.env.GRAPH_SCHEME || 'color'

const writeGraph = (label, graph) =>
  console.log(`${label} ${serializeAnsi(graph, traceScheme())}\n`)

const trace = graph =>
  writeGraph('observe', graph)

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const graph = compile(readFileSync(file, 'utf-8'))
  const found = observe(graph, trace)

  writeGraph('select ', select(found))
}
