import {
  compile,
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
  const { graph, legend, error } = compile(readFileSync(file, 'utf-8'))
  if (error) throw error

  const _trace = (x, label = 'observe') => trace(x, { label, legend })

  const result = observe(graph, _trace)
  trace(result, { label: 'result', legend })
  const repeat = observe(result, _trace)
  trace(repeat, { label: 'repeat', legend })
}
