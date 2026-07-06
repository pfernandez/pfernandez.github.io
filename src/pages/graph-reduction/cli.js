import { link, log, observe, trace } from './graph/index.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const parser = process.argv[3]
    && (await import(process.argv[3])).parse
  const source = readFileSync(file, 'utf-8')

  const linked = link(source, parser)
  const { graph, legend, error } = linked
  if (error) throw error

  const _trace = (x, label = 'observe') => trace(x, { label, legend })

  log({ file, parser, source, linked })

  trace(graph, { label: 'graph\n', legend })

  const result = observe(graph[1], _trace)
  trace(result, { label: 'result', legend })

  // Repeated observation continues reduction because `observe` returns
  // `pair[1]`. Returning `pair` instead provides a result that is stable under
  // repeated observation, but the right side (the function body) must then be
  // selected. This may point to a graph-native left observer with accumulated
  // history, and right focus with incoming next event.
  //
  // const next = observe(result, _trace)
  // trace(next, { label: 'next', legend })
}
