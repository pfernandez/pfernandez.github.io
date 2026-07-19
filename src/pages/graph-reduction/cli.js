import { compile, log, observe, serialize } from './graph/index.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const compiled = compile(readFileSync(file, 'utf-8'))

  log(compiled)

  let traceCount = 0
  const trace = form => console.log(
    traceCount++,
    serialize(form, { legend: compiled.legend, format: 'ansi' }),
    '\n')

  observe(compiled.graph, trace)
}
