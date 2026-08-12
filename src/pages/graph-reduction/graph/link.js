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
const isSuspended = graph => isDefinition(graph?.[0])
const atom = symbol => {
  const graph = []
  graph[0] = graph[1] = graph
  return Object.freeze(identify(graph, symbol))
}

// The linker uses four structural states; a suspension is an unfinished
// frontier, not a completed causal transition. If it remains unresolved,
// its supplied arguments are the causal prefix that actually occurred:
// atom                   [self, self]
// definition             [parameters, body]
// suspended application  [definition, supplied]
// completed application  [arguments, result]
const instantiate = (graph, mapping = []) => {
  const append = (graph, node) => isNamed(graph)
    ? Object.freeze([graph, node])
    : Object.freeze([graph[0], append(graph[1], node)])

  const match = (parameters, args) => {
    if (isFixed(parameters)) return [[parameters, args]]
    if (isFixed(args)) return

    const left = match(parameters[0], args[0])
    const right = match(parameters[1], args[1])
    return left && right && [...left, ...right]
  }

  let definition = graph[0]
  let args = graph[1]

  if (isSuspended(definition)) {
    args = append(definition[1], args)
    definition = definition[0]
    graph[0] = definition
    graph[1] = args
  }

  if (!isDefinition(definition) || !definition[1]) return

  const parameters = definition[0]
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

  if (ref || isSuspended(graph[0])) instantiate(graph)
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
    : fold(body, scopes).graph

  return Object.freeze(graph)
}

const context = (graph, focus = graph, call = false) => ({ graph, focus, call })

const fold = (expression, scopes = []) => {
  const graph = []
  scopes = [...scopes, graph]
  const [left, right] = expression
  const ref = isSymbol(left) && lookup(left, scopes)
  let focus = graph
  let call = false

  if (isSymbol(left)) {
    if (ref) {
      graph[0] = ref
      graph[1] = branch(right, scopes)
      instantiate(graph)
      call = isDefinition(ref)
    } else {
      identify(graph, left)
      if (Array.isArray(right)) {
        const definition = scope(right, scopes, graph)
        return context(definition)
      }

      graph[0] = graph[1] = atom(right)
    }
  } else {
    const previous = fold(left, scopes)
    graph[0] = previous.graph
    const following = isSymbol(right)
      ? context(lookup(right, scopes) || atom(right))
      : fold(right, scopes)

    graph[1] = following.graph

    if (isSuspended(previous.focus)) {
      instantiate(graph)
      call = true
    } else if (previous.call) {
      focus = graph[1] = Object.freeze([previous.focus[1], graph[1]])
      call = true
    } else if (isDefinition(previous.focus)) {
      focus = following.focus
      call = following.call
    } else {
      focus = graph
    }
  }

  // log({ graph, scopes })
  return context(Object.freeze(graph), focus, call)
}

export const link = source => {
  try {
    const ast = parse(source)
    const pairs = decompose(ast)
    const linked = isSymbol(pairs)
      ? context(atom(pairs))
      : fold(pairs)
    const focus = isSuspended(linked.focus)
      ? linked.focus[1]
      : linked.focus

    return { ast, pairs, focus, graph: linked.graph }
  } catch (error) {
    const graph = []
    return { graph, focus: graph, error }
  }
}

// Can we count cycles without allocation, i.e. with a binary counter?
