import {
  compile,
  observe,
  select,
  serializeAnsi
} from './graph/index.js'

let traceCount = 0

const traceScheme = () =>
  process.env.GRAPH_SCHEME || 'color'

const trace = form =>
  console.log(traceCount++, serializeAnsi(form, traceScheme()), '\n')

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const found = observe(compile(readFileSync(file, 'utf-8')), trace)
  trace(select(found))
}
