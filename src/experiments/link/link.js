const isSymbol = value => typeof value === 'string'

const extend = (scope, name, graph) =>
  new Map(scope).set(name, graph)

/** Replace authored names with identities, without evaluating the graph. */
export const link = (pairs, imports = {}) => {
  const legend = new Map()

  const identify = (graph, name, capability) => {
    legend.set(graph, capability ? { name, capability } : { name })
    return graph
  }

  const atom = (name, capability) => {
    const graph = identify([], name, capability)
    graph[0] = graph[1] = graph
    return graph
  }

  const initial = new Map(Object.entries(imports)
    .map(([name, capability]) => [name, atom(name, capability)]))

  const walk = (expression, scope = initial, enclosing) => {
    if (isSymbol(expression)) {
      const visible = scope.get(expression)
      if (visible) return { graph: visible, scope }

      const graph = atom(expression)
      return { graph, scope: extend(scope, expression, graph) }
    }

    const graph = []
    // () is the pair currently being connected.
    if (!expression.length) {
      if (enclosing) return { graph: enclosing, scope }
      graph[0] = graph[1] = graph
      return { graph, scope }
    }

    const [left, right] = expression
    const visible = isSymbol(left) && scope.get(left)

    // A fresh name on the left identifies this pair. Its inner names remain
    // local; the pair itself is visible to what follows.
    if (isSymbol(left) && !visible) {
      identify(graph, left)
      const local = extend(scope, left, graph)
      const following = walk(right, local, graph)
      graph[0] = graph
      graph[1] = following.graph
      return { graph, scope: extend(scope, left, graph) }
    }

    // Otherwise both authored sides remain, and identities introduced on the
    // left are visible while the right is connected.
    const before = walk(left, scope, graph)
    const after = walk(right, before.scope, graph)
    graph[0] = before.graph
    graph[1] = after.graph
    return { graph, scope: after.scope }
  }

  return { graph: walk(pairs).graph, legend }
}
