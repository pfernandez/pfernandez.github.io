const isSymbol = node => typeof node === 'string'

const extend = (scope, symbol, graph) =>
  new Map(scope).set(symbol, graph)

/**
 * Replace authored names with shared pair identities.
 *
 * This pass knows lexical visibility, definitions, and imported capabilities.
 * It does not apply definitions or construct application results. Every free
 * identity in a definition body is therefore connected before composition.
 */
export const connect = (pairs, imports = {}) => {
  const definitions = new Map()
  const calls = new Set()
  const legend = new Map()
  const owner = new Map()
  const values = new Set()
  const fills = new Set()
  const namedValues = new Set()
  const parameters = new Set()
  const root = Symbol()

  const identify = (graph, name, capability) => {
    const entry = { name }
    if (capability) entry.capability = capability
    if (capability?.literal) entry.arguments = 'literal'
    legend.set(graph, entry)
    return graph
  }

  const atom = (name, ownedBy, capability) => {
    const graph = identify([], name, capability)
    graph[0] = graph
    owner.set(graph, ownedBy)
    return graph
  }

  const literal = (expression, ownedBy) => {
    if (isSymbol(expression)) return atom(expression, ownedBy)

    const graph = []
    owner.set(graph, ownedBy)
    graph[0] = literal(expression[0], ownedBy)
    graph[1] = literal(expression[1], ownedBy)
    return graph
  }

  const initial = new Map(Object.entries(imports)
    .map(([name, capability]) =>
      [name, atom(name, undefined, capability)]))

  const context = (graph, scope) => ({ graph, scope })
  const callable = graph =>
    definitions.has(graph) || legend.get(graph)?.capability

  const walk = (
    expression,
    scope = initial,
    { definitionsAllowed = true,
      frame,
      ownedBy = root } = {}
  ) => {
    const next = (node, nextScope = scope, changes = {}) => walk(
      node,
      nextScope,
      { definitionsAllowed, frame, ownedBy, ...changes }
    )

    if (isSymbol(expression)) {
      const visible = scope.get(expression)
      const local = frame && visible !== frame.scope.get(expression)
      if (frame ? local : visible) return context(visible, scope)

      const graph = atom(expression, ownedBy)
      if (frame) {
        frame.parameters.add(graph)
        parameters.add(graph)
      }
      return context(graph, extend(scope, expression, graph))
    }

    const graph = []
    owner.set(graph, ownedBy)
    const [left, right] = expression

    // A pair in a definition's input introduces identities local to that input.
    if (frame) {
      const named = isSymbol(left) && Array.isArray(right)
      const pair = named ? right : expression
      let local = scope

      if (named) {
        const visible = scope.get(left)
        if (visible !== frame.scope.get(left))
          return context(visible, scope)

        identify(graph, left)
        frame.parameters.add(graph)
        parameters.add(graph)
        local = extend(scope, left, graph)
      }

      const before = next(pair[0], local)
      const after = next(pair[1], before.scope)
      graph[0] = before.graph
      graph[1] = after.graph
      return context(graph, after.scope)
    }

    const visible = isSymbol(left) && scope.get(left)
    const isNew = isSymbol(left) && !visible

    // An existing definition or capability is an application. Its argument is
    // connected as a value and remains unapplied in this intermediate graph.
    if (visible && callable(visible)) {
      const descriptor = legend.get(visible)
      const argument = descriptor?.arguments === 'literal'
        ? context(literal(right, ownedBy), scope)
        : next(right, scope, { definitionsAllowed: false })
      graph[0] = visible
      graph[1] = argument.graph
      calls.add(graph)
      values.add(argument.graph)
      return context(graph, scope)
    }

    // A value may name an application without adding another pair around it.
    // Naming a later application shadows an earlier value with the same name.
    if (isSymbol(left) && Array.isArray(right)) {
      const transition = isSymbol(right[0]) && scope.get(right[0])
      if (callable(transition) && (!definitionsAllowed || isNew)) {
        const state = next(right, scope, { definitionsAllowed: false })
        identify(state.graph, left)
        if (definitionsAllowed) namedValues.add(state.graph)
        return context(state.graph, extend(scope, left, state.graph))
      }

      if (!definitionsAllowed && isNew) {
        identify(graph, left)
        const local = extend(scope, left, graph)
        const before = next(right[0], local, { definitionsAllowed: false })
        const after = next(right[1], before.scope, {
          definitionsAllowed: false
        })
        graph[0] = before.graph
        graph[1] = after.graph
        return context(graph, extend(scope, left, graph))
      }
    }

    // A fresh compound head introduces a definition. Record it before walking
    // the body so recursive references connect to this exact identity.
    if (definitionsAllowed && isNew && Array.isArray(right)) {
      identify(graph, left)
      const local = extend(scope, left, graph)
      const frame = { scope: local, parameters: new Set() }
      definitions.set(graph, { parameters: frame.parameters })

      const input = next(right[0], local, { frame, ownedBy: graph })
      const body = next(right[1], input.scope, {
        frame: undefined,
        ownedBy: graph
      })
      graph[0] = input.graph
      graph[1] = body.graph
      definitions.set(graph, {
        input: input.graph,
        body: body.graph,
        parameters: frame.parameters
      })
      return context(graph, extend(scope, left, graph))
    }

    // With only one following state, a fresh name remains as a self-reference.
    if (isNew) {
      identify(graph, left)
      const following = next(right, extend(scope, left, graph))
      graph[0] = graph
      graph[1] = following.graph
      return context(graph, extend(scope, left, graph))
    }

    // A visible value occupies the causal left of an ordinary pair.
    if (visible) {
      const following = next(right, scope, { definitionsAllowed: false })
      graph[0] = visible
      graph[1] = following.graph
      calls.add(graph)
      if (parameters.has(visible) && Array.isArray(right)) fills.add(graph)
      return context(graph, scope)
    }

    // Every remaining pair is a sequence. Only identities introduced on its
    // left are visible while connecting its right.
    const before = next(left)
    const after = next(right, before.scope)
    graph[0] = before.graph
    graph[1] = after.graph
    return context(graph, after.scope)
  }

  return {
    calls,
    definitions,
    fills,
    graph: walk(pairs).graph,
    legend,
    namedValues,
    owner,
    root,
    values
  }
}
