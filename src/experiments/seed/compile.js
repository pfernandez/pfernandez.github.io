import { decompose } from '../../graph/decompose.js'
import { parse } from '../../graph/parse.js'

const isSymbol = value => typeof value === 'string'
const extend = (scope, name, identity) =>
  new Map(scope).set(name, identity)

const sequence = graphs => graphs.length === 1
  ? graphs[0]
  : [graphs[0], sequence(graphs.slice(1))]

/** Connect a sequence of pair-decomposed forms without applying them. */
export const connect = (forms, imports = {}) => {
  const legend = new Map()

  const atom = (name, capability) => {
    const identity = []
    identity[0] = identity[1] = identity
    legend.set(identity, capability ? { name, capability } : { name })
    return identity
  }

  const walk = (expression, scope = new Map()) => {
    if (isSymbol(expression)) {
      const visible = scope.get(expression)
      if (visible) return { graph: visible, scope }

      const graph = atom(expression)
      return { graph, scope: extend(scope, expression, graph) }
    }

    const [left, right] = expression

    // A repeated fresh name introduces one fixed identity.
    if (isSymbol(left) && left === right && !scope.has(left)) {
      const graph = atom(left)
      return { graph, scope: extend(scope, left, graph) }
    }

    // A fresh name followed by (parameter body) introduces a unary definition.
    if (isSymbol(left) && Array.isArray(right) && !scope.has(left)) {
      if (!isSymbol(right[0]))
        throw new TypeError('Definition input must be one symbol')

      const graph = []
      legend.set(graph, { name: left })
      const visible = extend(scope, left, graph)
      const parameter = atom(right[0])
      const local = extend(visible, right[0], parameter)
      const body = walk(right[1], local).graph

      graph[0] = graph
      graph[1] = [parameter, body]
      return { graph, scope: visible }
    }

    const before = walk(left, scope)
    const after = walk(right, before.scope)
    return { graph: [before.graph, after.graph], scope: after.scope }
  }

  let scope = new Map(Object.entries(imports).map(([name, capability]) => {
    const identity = atom(name, capability)
    return [name, identity]
  }))
  const graphs = forms.map(form => {
    const connected = walk(form, scope)
    scope = connected.scope
    return connected.graph
  })

  return {
    focus: graphs.at(-1),
    graph: sequence(graphs),
    legend
  }
}

const freeze = (graph, seen = new Set()) => {
  if (!Array.isArray(graph) || seen.has(graph)) return graph
  seen.add(graph)
  graph.forEach(node => freeze(node, seen))
  return Object.freeze(graph)
}

/** Parse, pair-decompose, connect, and freeze the functional subset. */
export const compile = (source, imports) => {
  const ast = parse(source)
  const forms = ast.every?.(Array.isArray) ? ast : [ast]
  const connected = connect(forms.map(decompose), imports)
  freeze(connected.graph)
  return connected
}
