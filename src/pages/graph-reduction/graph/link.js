Error.stackTraceLimit = 1
import { parse } from './parse.js'
import { log } from './serialize.js'

const find = (symbol, stack, i = stack.length - 1) =>
  i >= 0 && (stack[i].find(node => node?.symbol === symbol)
    ?? find(symbol, stack, i - 1))

const fix = (graph, symbol, ...rest) => {
  graph[0] = graph

  if (rest.length) graph.push(...rest)
  else graph[1] = graph

  graph['symbol'] = symbol
  return graph
}

const isSymbol = node => typeof node === 'string'

const fold = (tree, stack = []) => {
  if (!Array.isArray(tree)) return
  const graph = []
  stack = [...stack, graph]

  tree.forEach((node, i) => {
    if (isSymbol(node)) {
      const ref = find(node, stack)

      if (i === 0) {
        if (ref) graph[i] = ref
        else fix(graph, node, ...tree.slice(1))
      } else if (ref) {
        graph[i] = ref
      } else {
        const atom = fix([], node)
        graph[i] = Object.freeze(atom)
      }
    } else {
      const branch = fold(node, stack)
      graph[i] = branch

      if (i === 1 && isSymbol(tree[0]))
        stack = [...stack, branch]
    }
  })

  log({ graph, stack })
  return Object.freeze(graph)
}

export const link = source => {
  try {
    const tree = parse(source)
    return { graph: fold(tree) }
  } catch (error) {
    return { graph: [], error }
  }
}

// Can we count cycles without allocation, i.e. with a binary counter?
