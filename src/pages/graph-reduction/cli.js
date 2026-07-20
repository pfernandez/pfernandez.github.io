import {
  compile,
  link,
  log,
  loopPhase,
  nameOf,
  observe,
  orbit,
  serialize
} from './graph/index.js'
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
  const linked = process.argv[2] === '--link'
  const phase = process.argv[2] === '--phase'
  const record = process.argv[2] === '--record'
  const spine = process.argv[2] === '--spine'
  const file = lens
    ? process.argv[3] ?? new URL('./lens.lisp', import.meta.url)
    : linked
      ? process.argv[3] ?? new URL('./link-counter.lisp', import.meta.url)
      : phase
        ? process.argv[3] ?? new URL('./link-kernel.lisp', import.meta.url)
        : record || spine
          ? process.argv[3] ?? new URL('./core.lisp', import.meta.url)
          : process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  let compiled = linked || phase
    ? link(readFileSync(file, 'utf-8'))
    : compile(readFileSync(file, 'utf-8'))

  if (compiled.error) throw compiled.error

  if (record) {
    const outputs = []
    const answer = observe(compiled.graph, frame => outputs.push(frame))

    compiled = recordLens([...outputs, answer[1]], {
      legend: compiled.legend
    })
  }

  if (!linked && !phase) log(compiled)

  let traceCount = 0
  const trace = form => console.log(
    traceCount++,
    serialize(form, { legend: compiled.legend, format: 'ansi' }),
    '\n')

  if (phase) {
    const count = Number(process.argv[4] ?? 80)
    const result = orbit(compiled.graph, {
      count,
      label: nameOf.bind(null, compiled.legend),
      phase: loopPhase(compiled.legend)
    })

    console.log('phases', result.phases.join(' '))
    console.log('period', result.period ?? '?')
    console.log('gaps', result.gaps.join(' '))
    console.log(
      'transitions',
      result.transitions.map(([from, to]) => `${from}->${to}`).join(' '))
  } else if (linked) {
    let state = compiled.graph
    const count = Number(process.argv[4] ?? 32)
    const nameOf = node =>
      compiled.legend.find(entry => entry.node === node)?.symbol

    for (let i = 0; i < count; i += 1) {
      const loop = nameOf(state[0]?.[0]?.[0]) === 'Loop'
      const register = loop && nameOf(state[0][1])
      const preview = serialize(state, { legend: compiled.legend })

      console.log('state', i, register || '')
      console.log(`${preview.slice(0, 160)}${preview.length > 160 ? '…' : ''}`)
      console.log('\n')
      state = step(state)
    }
  } else if (spine) {
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
