Error.stackTraceLimit = 1
import { parse } from './parse.js'
import { log } from './serialize.js'

const find = (symbol, stack, i = stack.length - 1) =>
  i >= 0 && (stack[i].find(node => node?.symbol === symbol)
    ?? find(symbol, stack, i - 1))

const fold = (tree, stack = []) => {
  if (!Array.isArray(tree)) return
  const graph = []
  stack = [...stack, graph]

  tree.forEach((node, i) => {
    if (typeof node === 'string') {
      const ref = find(node, stack)

      if (i === 0) {
        graph[i] = ref || graph
        graph['symbol'] = node
      } else if (ref) {
        graph[i] = ref
      } else {
        const atom = []
        graph[i] = atom[0] = atom[1] = atom
        atom['symbol'] = node
        Object.freeze(atom)
      }
    } else {
      const branch = fold(node, stack)
      graph[i] = branch

      if (i === 1 && graph['symbol'])
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
