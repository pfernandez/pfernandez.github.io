import { link, log, step, trace } from './graph/index.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const source = readFileSync(file, 'utf-8')

  const linked = link(source)
  const { graph, error } = linked

  if (error) throw error

  trace(graph, { label: 'graph\n' })
  // trace(linked.focus, { label: 'focus' })
  // trace(step(linked.focus), { label: 'next' })

  // `step` is only a right-edge projection. The graph remains stable while
  // focus and history describe the observer's path through it.
}
