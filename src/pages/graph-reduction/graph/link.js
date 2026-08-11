Error.stackTraceLimit = 1
import { decompose } from './decompose.js'
import { parse } from './parse.js'
import { log } from './serialize.js'

const lookup = (symbol, scopes, i = scopes.length - 1) =>
  i >= 0 && (scopes[i].symbol === symbol
    ? scopes[i]
    : scopes[i].find(node => node?.symbol === symbol)
      ?? lookup(symbol, scopes, i - 1))

const identify = (graph, symbol) => {
  graph['symbol'] = symbol

  return graph
}

const isSymbol = node => typeof node === 'string'
const isFixed = graph => graph[1] === graph
const isNamed = graph => graph?.['symbol'] !== undefined
const isDefinition = graph => isNamed(graph) && !isFixed(graph)
const atom = symbol => {
  const graph = []
  graph[0] = graph[1] = graph
  return Object.freeze(identify(graph, symbol))
}

// Definitions are [parameters, body]. Applications begin as
// [definition, args]; completed applications become [args, result].
const instantiate = (graph, mapping = []) => {
  const match = (parameters, args) => {
    if (isFixed(parameters)) return [[parameters, args]]
    if (isFixed(args)) return

    const left = match(parameters[0], args[0])
    const right = match(parameters[1], args[1])
    return left && right && [...left, ...right]
  }

  const definition = graph[0]
  if (!isDefinition(definition) || !definition[1]) return

  const parameters = definition[0]
  const args = graph[1]
  const bound = match(parameters, args)

  if (!bound) return

  mapping = [...bound, ...mapping]

  const copy = node => {
    const ref = mapping.find(([source]) => source === node)
    if (ref) return ref[1]
    if (isNamed(node)) return node

    const branch = []
    mapping.push([node, branch])
    branch[0] = copy(node[0])
    branch[1] = copy(node[1])
    instantiate(branch, mapping)
    return Object.freeze(branch)
  }

  graph[0] = args
  graph[1] = copy(definition[1])
}

const branch = (expression, scopes) => {
  if (isSymbol(expression)) return lookup(expression, scopes) || atom(expression)

  const graph = []
  scopes = [...scopes, graph]
  const [left, right] = expression
  const ref = isSymbol(left) && lookup(left, scopes)

  graph[0] = isSymbol(left)
    ? ref || atom(left)
    : branch(left, scopes)
  graph[1] = isSymbol(right)
    ? lookup(right, scopes) || atom(right)
    : branch(right, scopes)

  if (ref) instantiate(graph)
  return Object.freeze(graph)
}

const scope = (expression, scopes, graph) => {
  const define = expression => {
    if (isSymbol(expression)) {
      const graph = atom(expression)
      scopes.push(graph)
      return graph
    }

    const graph = []
    const [left, right] = expression
    graph[0] = define(left)
    graph[1] = define(right)
    return Object.freeze(graph)
  }

  const [parameters, body] = expression
  scopes = [...scopes]

  graph[0] = define(parameters)
  graph[1] = isSymbol(body)
    ? lookup(body, scopes) || atom(body)
    : fold(body, scopes)

  return Object.freeze(graph)
}

const fold = (expression, scopes = []) => {
  const graph = []
  scopes = [...scopes, graph]
  const [left, right] = expression
  const ref = isSymbol(left) && lookup(left, scopes)

  if (isSymbol(left)) {
    if (ref) {
      graph[0] = ref
      graph[1] = branch(right, scopes)
      instantiate(graph)
    } else {
      identify(graph, left)
      if (Array.isArray(right)) return scope(right, scopes, graph)

      graph[0] = graph[1] = atom(right)
    }
  } else {
    graph[0] = fold(left, scopes)
    graph[1] = isSymbol(right)
      ? lookup(right, scopes) || atom(right)
      : fold(right, scopes)
  }

  // log({ graph, scopes })
  return Object.freeze(graph)
}

const focus = (tree, graph) =>
  isSymbol(tree) || isSymbol(tree[0]) || !isDefinition(graph[0])
    ? graph
    : focus(tree[1], graph[1])

export const link = source => {
  try {
    const ast = parse(source)
    const pairs = decompose(ast)
    const graph = isSymbol(pairs) ? atom(pairs) : fold(pairs)
    return { ast, pairs, graph, focus: focus(pairs, graph) }
  } catch (error) {
    const graph = []
    return { graph, focus: graph, error }
  }
}

// Can we count cycles without allocation, i.e. with a binary counter?
