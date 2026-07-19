import { compile, log, observe, serialize } from './graph/index.js'
import { output, step } from './graph/lens.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const lens = process.argv[2] === '--lens'
  const file = lens
    ? process.argv[3] ?? new URL('./lens.lisp', import.meta.url)
    : process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const compiled = compile(readFileSync(file, 'utf-8'))

  log(compiled)

  let traceCount = 0
  const trace = form => console.log(
    traceCount++,
    serialize(form, { legend: compiled.legend, format: 'ansi' }),
    '\n')

  if (lens) {
    let state = compiled.graph
    const count = Number(process.argv[4] ?? 4)

    for (let i = 0; i < count; i += 1) {
      const event = observe(state)

      console.log('state', i)
      trace(state)
      console.log('event')
      trace(event)
      console.log('output')
      trace(output(event))
      state = step(state)
    }
  } else {
    observe(compiled.graph, trace)
  }
}
