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

const bind = (parameters, arguments_) => new Map(
  parameters[1] === parameters
    ? [[parameters, arguments_]]
    : parameters.map((parameter, i) => [parameter, arguments_[i]]))

const copy = (node, refs) => {
  if (refs.has(node)) return refs.get(node)
  if (node[0] === node) return node
  const graph = []
  refs.set(node, graph)
  node.forEach(child => graph.push(copy(child, refs)))
  return Object.freeze(graph)
}

const fold = (tree, stack = [], definitions = new WeakSet()) => {
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
      const signature = i === 1 && graph[0] === graph
      const branch = fold(node, signature ? [] : stack, definitions)
      graph[i] = branch

      if (!signature && branch[0] === branch)
        definitions.add(branch)

      if (i === 1 && isSymbol(tree[0]))
        stack = [...stack, branch]
    }
  })

  const definition = graph[0]
  if (tree.length === 2 && isSymbol(tree[0]) &&
      definitions.has(definition) && definition[2])
    graph.push(copy(definition[2], bind(definition[1], graph[1])))

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
