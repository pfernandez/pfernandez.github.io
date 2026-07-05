import { link, log, observe, trace } from './graph/index.js'

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)
  const syntax = process.argv[3] && await import(process.argv[3])
  const source = readFileSync(file, 'utf-8')

  const program = syntax ? syntax.compile(source) : { source }

  const linked = link(program.source)
  const { graph, error } = linked

  const legend = [
    ...linked.legend,
    ...program.legend ?? [],
    ...program.decorate?.(graph) ?? []
  ]

  if (error) throw error

  const _trace = (x, label = 'observe') => trace(x, { label, legend })

  log({ file, syntax, source, program, linked, legend })

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
