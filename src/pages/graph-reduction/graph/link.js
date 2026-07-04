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
    return entry
  }

  const startDefinition = (parent, i, symbol) => {
    const entry = { node: parent, symbol, parent, index: i, parameters: [] }
    stack.push(entry)
    legend.push(entry)
    return entry
  }

  const completeDefinition = (entry, form, parameter) => {
    entry.node = form
    entry.parent[entry.index] = form
    if (parameter)
      entry.parameters.push(parameter.node)
    else
      entry.body = form[1]
    return entry
  }

  const walk = (tree, replacements) => {
    if (replacements) {
      const replacement = replacements.find(([from]) => tree === from)
      if (replacement) return { graph: replacement[1] }
      if (tree[0] === tree || stack.some(({ node }) => node === tree))
        return { graph: tree }
      return { graph: tree.map(node => walk(node, replacements).graph) }
    }

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
        if (i === 0 && entry.body) {
          // Definition applied: Give this call its own answer identity.
          const answer = []
          answer[0] = answer
          graph[i] = answer
          legend.push({ node: answer, symbol: node })
          return { call: { answer, definition: entry, arguments: [] } }
        }

        // Cached identity: Replace the symbol.
        graph[i] = entry.node
        return {}
      } else if (i === 0 && isSignature) {
        // New leftmost signature symbol: Start a definition.
        return { definition: startDefinition(graph, i, node) }
      } else {
        // New argument or value: Give it a fixed identity.
        return { introduced: identifyAtom(graph, i, node) }
      }
    })

    // Walk outward through the signature unless another definition follows.
    const definition = left.definition && !right.definition
      ? completeDefinition(left.definition, graph, right.introduced)
      : undefined

    if (definition && !right.introduced) {
      // Definition complete: Keep its name and pop its parameters.
      stack.length = scopeStart
      stack.push(definition)
    }

    const call = left.call
    if (call) {
      call.arguments.push(graph[1])
      const arity = call.definition.parameters.length

      if (call.arguments.length < arity) {
        // A partial call observes as itself.
        call.answer[1] = graph
      } else if (call.arguments.length === arity) {
        // A complete call observes as a copy with its parameters replaced.
        const replacements = call.definition.parameters.map((parameter, i) =>
          [parameter, call.arguments[i]])
        call.answer[1] = walk(call.definition.body, replacements).graph
      } else {
        // Keep arguments supplied after the completed call.
        call.answer[1] = [call.answer[1], graph[1]]
      }
    }

    return { graph, definition, call }
  }

  try {
    const result = {
      graph: walk(parse(source)[0]).graph,
      legend: legend.map(({ node, symbol }) => ({ node, symbol }))
    }

    return result
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
