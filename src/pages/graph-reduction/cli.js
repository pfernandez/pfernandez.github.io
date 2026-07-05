import {
  link,
  observe,
  trace
} from './graph/index.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const { graph, legend, error } = link(readFileSync(file, 'utf-8'))
  if (error) throw error

  const _trace = (x, label = 'observe') => trace(x, { label, legend })

  trace(graph, { label: 'graph\n', legend })

  const result = observe(graph[1], _trace)
  trace(result, { label: 'result', legend })
}
