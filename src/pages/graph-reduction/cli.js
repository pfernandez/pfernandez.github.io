import {
  compile,
  observe,
  serialize
} from './graph/index.js'

const traceScheme = () =>
  process.env.GRAPH_SCHEME || 'color'

const writeGraph = (label, graph, legend) =>
  console.log(`${label} ${serialize(graph, {
    legend,
    format: 'ansi',
    scheme: traceScheme()
  })}\n`)

const trace = legend => graph =>
  writeGraph('observe', graph, legend)

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const { graph, legend, error } = compile(readFileSync(file, 'utf-8'))
  if (error) throw error
  observe(graph, trace(legend))
  // writeGraph(
  //   'result ',
  //   observe(observe(graph, trace(legend)), trace(legend)),
  //   legend)
}
