Error.stackTraceLimit = 1
import { decompose } from './decompose.js'
import { parse } from './parse.js'
import { log } from './serialize.js'

const lookup = (symbol, scopes, i = scopes.length - 1) =>
  i >= 0 && (scopes[i].find(node => node?.symbol === symbol)
    ?? lookup(symbol, scopes, i - 1))

const identify = (symbol, graph) => {
  const fixed = graph === undefined
  graph ||= []
  graph[0] = graph[1] = graph
  graph['symbol'] = symbol

  return fixed ? Object.freeze(graph) : graph
}

const isSymbol = node => typeof node === 'string'
const isIdentified = graph => graph[0] === graph
const isFixed = graph => graph[1] === graph

// Fresh identities are [self, scope]. Applications begin as
// [definition, args]; completed applications become [args, result].
const instantiate = (graph, scopes, mapping = []) => {
  const match = (parameters, args) => {
    if (isIdentified(parameters)) {
      if (isFixed(parameters)) return [[parameters, args]]
      if (isFixed(args)) return

      const rest = match(parameters[1], args[1])
      return rest && [[parameters, args[0]], ...rest]
    }

    if (isIdentified(args)) return
    const left = match(parameters[0], args[0])
    const right = match(parameters[1], args[1])
    return left && right && [...left, ...right]
  }

  const definition = graph[0]
  const established = scopes.some(scope =>
    scope[0] !== scope && scope.includes(definition))

  if (!established) return

  const parameters = definition[1][0]
  const args = graph[1]
  const bound = match(parameters, args)

  if (!bound) return

  mapping = [...bound, ...mapping]

  const copy = node => {
    const ref = mapping.find(([source]) => source === node)
    if (ref) return ref[1]
    if (isIdentified(node)) return node

    const branch = []
    mapping.push([node, branch])
    branch[0] = copy(node[0])
    branch[1] = copy(node[1])
    instantiate(branch, scopes, mapping)
    return Object.freeze(branch)
  }

  graph[0] = args
  graph[1] = copy(definition[1][1])
}

const scope = (expression, scopes) => {
  const define = expression => {
    const graph = []
    if (isSymbol(expression)) {
      identify(expression, graph)
    } else {
      const [left, right] = expression
      if (isSymbol(left)) identify(left, graph)
      else graph[0] = define(left)
      graph[1] = define(right)
    }

    if (isIdentified(graph)) scopes.push(graph)
    return Object.freeze(graph)
  }

  const graph = []
  const [parameters, body] = expression
  scopes = [...scopes]

  graph[0] = isSymbol(parameters)
    ? identify(parameters, graph)
    : define(parameters)
  if (isIdentified(graph)) scopes.push(graph)
  graph[1] = isSymbol(body)
    ? lookup(body, scopes) || identify(body)
    : fold(body, scopes)

  return Object.freeze(graph)
}

const fold = (expression, scopes = []) => {
  const graph = []
  const enclosing = scopes
  scopes = [...enclosing, graph]
  const [left, right] = expression
  const ref = isSymbol(left) && lookup(left, scopes)

  if (isSymbol(left)) {
    if (ref) graph[0] = ref
    else identify(left, graph)
  } else {
    graph[0] = fold(left, scopes)
  }

  const introduced = isIdentified(graph)
  if (introduced) {
    graph[1] = isSymbol(right)
      ? identify(right)
      : scope(right, scopes)
  } else {
    graph[1] = isSymbol(right)
      ? lookup(right, scopes) || identify(right)
      : fold(right, scopes)
  }

  if (ref) instantiate(graph, enclosing)

  // log({ graph, scopes })
  return Object.freeze(graph)
}

const focus = (tree, graph) =>
  isSymbol(tree) || isSymbol(tree[0]) || !isIdentified(graph[0])
    ? graph
    : focus(tree[1], graph[1])

export const link = source => {
  try {
    const ast = parse(source)
    const pairs = decompose(ast)
    const graph = isSymbol(pairs) ? identify(pairs) : fold(pairs)
    return { ast, pairs, graph, focus: focus(pairs, graph) }
  } catch (error) {
    const graph = []
    return { graph, focus: graph, error }
  }
}

// Can we count cycles without allocation, i.e. with a binary counter?
