Error.stackTraceLimit = 1
import { parse } from './parse.js'
import { log } from './serialize.js'

const resolve = (symbol, scopes, i = scopes.length - 1) =>
  i >= 0 && (scopes[i].find(node => node?.symbol === symbol)
    ?? resolve(symbol, scopes, i - 1))

const identify = (graph, symbol) => {
  graph[0] = graph[1] = graph
  graph['symbol'] = symbol

  return graph
}

const isSymbol = node => typeof node === 'string'

const isApplication = node => node.length === 2 && isSymbol(node[0])

const instantiate = (graph, scopes) => {
  const definition = graph[0]
  const established = scopes.some(scope =>
    scope !== graph && scope[0] !== scope && scope.includes(definition))

  if (!established || !definition[2]) return

  const parameters = definition[1]
  const args = graph[1]
  const mapping = parameters[1] === parameters
    ? [[parameters, args]]
    : parameters.map((parameter, i) => [parameter, args[i]])

  const copy = node => {
    const ref = mapping.find(([source]) => source === node)
    if (ref) return ref[1]
    if (node[0] === node) return node

    const branch = []
    mapping.push([node, branch])
    node.forEach(child => branch.push(copy(child)))
    return Object.freeze(branch)
  }

  graph[0] = args
  graph[1] = copy(definition[2])
}

const fold = (expression, scopes = []) => {
  if (!Array.isArray(expression)) return
  const graph = []
  scopes = [...scopes, graph]

  expression.forEach((node, i) => {
    const parameter = i === 1 && graph[0] === graph

    if (isSymbol(node)) {
      const ref = parameter ? undefined : resolve(node, scopes)

      if (i === 0) {
        if (ref) graph[i] = ref
        else identify(graph, node)
      } else if (ref) {
        graph[i] = ref
      } else {
        const atom = identify([], node)
        graph[i] = Object.freeze(atom)
      }
    } else {
      const branch = fold(node, parameter ? [] : scopes)
      graph[i] = branch

      if (i === 1 && isSymbol(expression[0]))
        scopes = [...scopes, branch]
    }
  })

  if (isApplication(expression)) instantiate(graph, scopes)

  // log({ graph, scopes })
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
