import { parse } from './parse.js'

export const link = source => {
  const stack = []
  const legend = []
  const isSymbol = node => !Array.isArray(node)

  const createNode = (parent, i, symbol) => {
    const node = parent[i] = []
    node[0] = node[1] = node
    const entry = { node, symbol }
    stack.push(entry)
    legend.push(entry)
  }

  const startDefinition = (parent, i, symbol) => {
    const entry = {
      node: parent,
      symbol,
      parent,
      index: i
    }
    stack.push(entry)
    legend.push(entry)
    return entry
  }

  const completeDefinition = (entry, form) => {
    entry.node = form
    entry.parent[entry.index] = form
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
        createNode(graph, i, node)
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
    const label = ({ node, symbol }) => ({ node, symbol })
    return {
      graph: walk(parse(source)[0]).graph,
      legend: legend.map(label)
    }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
