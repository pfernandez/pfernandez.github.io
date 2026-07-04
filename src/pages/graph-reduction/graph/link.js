import { parse } from './parse.js'

export const link = source => {
  const stack = []
  const legend = []
  const isSymbol = node => !Array.isArray(node)

  const identifyAtom = (parent, i, symbol) => {
    const node = parent[i] = []
    node[0] = node[1] = node
    const entry = { node, symbol }
    stack.push(entry)
    legend.push(entry)
  }

  const startDefinition = (parent, i, symbol) => {
    const entry = { node: parent, symbol, parent, index: i }
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
    const graph = tree
    const scopeStart = stack.length
    const isSignature = tree.every(isSymbol)

    const [left, right] = tree.map((node, i) => {
      if (!isSymbol(node)) {
        // Pair found: Link it before handling the enclosing pair.
        return walk(node)
      }

      // Symbol seen before: Reuse the closest stack entry.
      const entry = stack.findLast(({ symbol }) => node === symbol)

      if (entry) {
        // Cached identity: Replace the symbol.
        graph[i] = entry.node
        return {}
      } else if (i === 0 && isSignature) {
        // New leftmost signature symbol: Start a definition.
        return { definition: startDefinition(graph, i, node) }
      } else {
        // New argument or value: Give it a fixed identity.
        identifyAtom(graph, i, node)
        return { introduced: true }
      }
    })

    // Walk outward through the signature unless another definition follows.
    const definition = left.definition && !right.definition
      ? completeDefinition(left.definition, graph)
      : undefined

    if (definition && !right.introduced) {
      // Definition complete: Keep its name and pop its parameters.
      stack.length = scopeStart
      stack.push(definition)
    }

    return { graph, definition }
  }

  try {
    const result = {
      graph: walk(parse(source)[0]).graph,
      legend: legend.map(({ node, symbol }) => ({ node, symbol }))
    }

    // console.dir(result, { depth: null })
    return result
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
