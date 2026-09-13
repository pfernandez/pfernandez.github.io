const isSymbol = value => typeof value === 'string'
const isLiteral = value =>
  typeof value === 'object' && value !== null
  && Object.hasOwn(value, 'value')

const extend = (scope, name, graph) => new Map(scope).set(name, graph)

const readonly = map => Object.freeze({
  get: key => map.get(key),
  has: key => map.has(key)
})

/** Replace authored names with identities, without evaluating the graph. */
export const link = (pairs, imports = {}) => {
  const legend = new Map()

  const identify = (graph, entry) => {
    legend.set(graph, Object.freeze(entry))
    return graph
  }

  const atom = entry => {
    const graph = identify([], entry)
    graph[0] = graph[1] = graph
    return graph
  }

  const initial = new Map(Object.entries(imports)
    .map(([name, value]) => [name, atom({ name, value })]))

  const walk = (expression, scope = initial, enclosing) => {
    if (isLiteral(expression))
      return { graph: atom(expression), scope }

    if (isSymbol(expression)) {
      const visible = scope.get(expression)
      if (visible) return { graph: visible, scope }

      const graph = atom({ name: expression })
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
      identify(graph, { name: left })
      const local = extend(scope, left, graph)
      const following = walk(right, local, graph)
      graph[0] = graph
      graph[1] = following.graph
      return { graph, scope: local }
    }

    // Otherwise both authored sides remain, and identities introduced on the
    // left are visible while the right is connected.
    const before = walk(left, scope, graph)
    const after = walk(right, before.scope, graph)
    graph[0] = before.graph
    graph[1] = after.graph
    return { graph, scope: after.scope }
  }

  return { graph: walk(pairs).graph, legend: readonly(legend) }
}
