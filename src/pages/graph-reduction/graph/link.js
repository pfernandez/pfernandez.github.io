Error.stackTraceLimit = 1
import { parse } from './parse.js'
import { log } from './serialize.js'

const find = (symbol, stack, i = stack.length - 1) =>
  i >= 0 && (stack[i].find(node => node?.symbol === symbol)
    ?? find(symbol, stack, i - 1))

const fix = (graph, symbol, ...rest) => {
  graph[0] = graph
  graph['symbol'] = symbol

  if (rest.length) graph.push(...rest)
  else graph[1] = graph

  return graph
}

const isSymbol = node => typeof node === 'string'

const isCall = node => node.length === 2 && isSymbol(node[0])

const apply = (graph, stack) => {
  const library = stack
    .filter(scope => scope !== graph && scope[0] !== scope)

  const definition = graph[0]
  const defined = library.some(scope => scope.includes(definition))

  if (!defined || !definition[2]) return

  const parameters = definition[1]
  const args = graph[1]
  const refs = parameters[1] === parameters
    ? [[parameters, args]]
    : parameters.map((parameter, i) => [parameter, args[i]])

  const copy = node => {
    const ref = refs.find(([source]) => source === node)
    if (ref) return ref[1]
    if (node[0] === node) return node

    const branch = []
    refs.push([node, branch])
    node.forEach(child => branch.push(copy(child)))
    return Object.freeze(branch)
  }

  graph[0] = args
  graph[1] = copy(definition[2])
}

const fold = (expression, stack = []) => {
  if (!Array.isArray(expression)) return
  const graph = []
  stack = [...stack, graph]

  expression.forEach((node, i) => {
    if (isSymbol(node)) {
      const ref = find(node, stack)

      if (i === 0) {
        if (ref) graph[i] = ref
        else fix(graph, node, ...expression.slice(1))
      } else if (ref) {
        graph[i] = ref
      } else {
        const atom = fix([], node)
        graph[i] = Object.freeze(atom)
      }
    } else {
      const signature = i === 1 && graph[0] === graph
      const branch = fold(node, signature ? [] : stack)
      graph[i] = branch

      if (i === 1 && isSymbol(expression[0]))
        stack = [...stack, branch]
    }
  })

  if (isCall(expression)) apply(graph, stack)
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
