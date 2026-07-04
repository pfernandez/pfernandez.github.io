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

  const definitionFor = node =>
    stack.find(entry => entry.node === node && entry.body)

  const startCall = (graph, definition) => {
    const answer = []
    answer[0] = answer
    graph[0] = answer
    legend.push({ node: answer, symbol: definition.symbol })
    return { answer, definition, arguments: [] }
  }

  const walk = (tree, replacements) => {
    let graph, left, right, definition

    if (replacements) {
      const replacement = replacements.find(([from]) => tree === from)
      const node = replacement?.[1] ?? tree
      const reference = definitionFor(node)

      if (replacement || tree[0] === tree || reference)
        return { graph: node, reference }

      const children = tree.map(node => walk(node, replacements))
      left = children[0]
      right = children[1]
      graph = [left.graph, right.graph]
    } else {
      graph = tree
      const scopeStart = stack.length
      const isSignature = tree.every(isSymbol)
      const defining = stack.some(entry => entry.parameters && !entry.body)

      const children = tree.map((node, i) => {
        if (!isSymbol(node)) {
          // Pair found: Link it before handling the enclosing pair.
          return walk(node)
        }

        // Symbol seen before: Reuse the closest stack entry.
        const entry = stack.findLast(({ symbol }) => node === symbol)

        if (entry) {
          // Cached identity: Replace the symbol.
          graph[i] = entry.node
          return {
            reference: i === 0 && entry.body && !defining
              ? entry
              : undefined
          }
        } else if (i === 0 && isSignature) {
          // New leftmost signature symbol: Start a definition.
          return { definition: startDefinition(graph, i, node) }
        } else {
          // New argument or value: Give it a fixed identity.
          return { introduced: identifyAtom(graph, i, node) }
        }
      })
      left = children[0]
      right = children[1]

      // Walk outward through the signature unless another definition follows.
      definition = left.definition && !right.definition
        ? completeDefinition(left.definition, graph, right.introduced)
        : undefined

      if (definition && !right.introduced) {
        // Definition complete: Keep its name and pop its parameters.
        stack.length = scopeStart
        stack.push(definition)
      }
    }

    const call = left.call ?? (
      left.reference && startCall(graph, left.reference))

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
        call.answer[1] = walk([call.answer[1], graph[1]], []).graph
      }
    }

    return { graph, definition, call }
  }

  try {
    const graph = walk(parse(source)[0]).graph
    return {
      graph,
      legend: legend.map(({ node, symbol }) => ({ node, symbol }))
    }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
