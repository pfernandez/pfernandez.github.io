import { compile, log, observe, serialize } from './graph/index.js'
import {
  output,
  record as recordLens,
  spineOutput,
  spineStep,
  step
} from './graph/lens.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const lens = process.argv[2] === '--lens'
  const record = process.argv[2] === '--record'
  const spine = process.argv[2] === '--spine'
  const file = lens
    ? process.argv[3] ?? new URL('./lens.lisp', import.meta.url)
    : record || spine
      ? process.argv[3] ?? new URL('./core.lisp', import.meta.url)
      : process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  let compiled = compile(readFileSync(file, 'utf-8'))

  if (record) {
    const outputs = []
    const answer = observe(compiled.graph, frame => outputs.push(frame))

    compiled = recordLens([...outputs, answer[1]], {
      legend: compiled.legend
    })
  }

  log(compiled)

  let traceCount = 0
  const trace = form => console.log(
    traceCount++,
    serialize(form, { legend: compiled.legend, format: 'ansi' }),
    '\n')

  if (spine) {
    let state = compiled.graph
    const count = Number(process.argv[4] ?? 6)

    for (let i = 0; i < count; i += 1) {
      console.log('state', i)
      trace(state)
      console.log('output')
      trace(spineOutput(state))
      state = spineStep(state)
    }
  } else if (lens || record) {
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
