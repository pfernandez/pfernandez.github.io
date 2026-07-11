import { link, log, step, trace } from './graph/index.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const source = readFileSync(file, 'utf-8')

  const { graph, legend, error } = link(source)
  if (error) throw error

  log({ file, source, graph, legend })

  trace(graph, { label: 'graph\n', legend })
  const focus = step(graph)
  trace(focus, { label: 'step', legend })
  const result = step(focus)
  trace(result, { label: 'result', legend })

  // `step` is only a right-edge projection. The graph must carry any observer
  // state, history, and next event needed to make that projection meaningful.
}
