import { parse } from './parse.js'

export const link = source => {
  const stack = []
  const isSymbol = node => !Array.isArray(node)

  const createNode = (parent, i, symbol) => {
    const node = parent[i] = []
    node[0] = node[1] = node
    const entry = { node, symbol, name: [node, symbol], variables: [] }
    stack.push(entry)
    return entry
  }

  const startDefinition = (parent, i, symbol) => {
    const entry = {
      node: parent,
      symbol,
      name: [parent, symbol],
      variables: [],
      parent,
      index: i
    }
    stack.push(entry)
    return entry
  }

  const completeDefinition = (entry, form) => {
    entry.node = form
    entry.parent[entry.index] = form
    entry.name[0] = form
    return entry
  }

  const walk = tree => {
    const graph = []
    const scopeStart = stack.length
    const isSignature = tree.every(isSymbol)
    let leftDefinition, definition, hasRightDefinition, hasNewParameter

    tree.forEach((node, i) => {
      if (!isSymbol(node)) {
        // Pair found: Link it before handling the enclosing pair.
        const child = walk(node)
        // Linked child: Insert it into this pair.
        graph[i] = child.graph
        // Definition found on the left: Let it name the enclosing pair.
        if (i === 0) {
          leftDefinition = child.definition
        } else {
          // Right definition: Block completion.
          hasRightDefinition ||= !!child.definition
        }
        return
      }

      // Symbol seen before: Reuse the closest stack entry.
      const entry = stack.findLast(({ symbol }) => node === symbol)

      if (entry) {
        // Cached identity: Replace the symbol.
        graph[i] = entry.node
      } else if (i === 0 && isSignature) {
        // New leftmost signature symbol: Start a definition.
        definition = startDefinition(graph, i, node)
      } else {
        // New argument or value: Create an identity.
        const variable = createNode(graph, i, node)
        // Signature or body context: Find the definition that owns it.
        const owner = isSignature ? definition : leftDefinition

        // Definition in progress: Remember its parameter.
        if (owner) owner.variables.push(variable.name)
        // New right-side parameter: Keep walking before popping scope.
        hasNewParameter ||= i === 1 && leftDefinition
      }
    })

    // Signature has a body: Complete the definition.
    const result = leftDefinition && !hasRightDefinition
      ? completeDefinition(leftDefinition, graph)
      : definition

    if (leftDefinition && result && !hasNewParameter) {
      // Definition complete: Keep its name and pop its parameters.
      stack.length = scopeStart
      stack.push(result)
    }

    return { graph, definition: result }
  }

  try {
    return {
      graph: walk(parse(source)[0]).graph,
      legend: stack.flatMap(({ name, variables }) => [name, ...variables])
    }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
