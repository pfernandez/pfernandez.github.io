import { parse } from './parse.js'

export const link = source => {
  // One stack holds identities in scope and calls built during the walk.
  const stack = []
  // The legend keeps source names outside the finished graph.
  const legend = []
  const isSymbol = node => !Array.isArray(node)

  // Replace a new variable with a pair that points to itself.
  const identifyAtom = (parent, i, symbol) => {
    const node = parent[i] = []
    node[0] = node[1] = node
    const entry = { node, symbol }
    stack.push(entry)
    legend.push(entry)
    return entry
  }

  // A definition starts at its innermost signature pair. Its identity grows
  // outward as the rest of its signature and body are found.
  const startDefinition = (parent, i, symbol) => {
    const entry = {
      node: parent,
      symbol,
      parent,
      index: i,
      parameters: [],
      references: []
    }
    stack.push(entry)
    legend.push(entry)
    return entry
  }

  // Make the enclosing form the definition's new identity. A parameter keeps
  // the definition open; a body closes it and repairs its early references.
  const completeDefinition = (entry, form, parameter) => {
    entry.node = form
    entry.parent[entry.index] = form
    if (parameter)
      entry.parameters.push(parameter.node)
    else {
      entry.body = form[1]
      for (const [parent, i] of entry.references)
        parent[i] = form
    }
    return entry
  }

  const definitionFor = node =>
    stack.find(entry => entry.node === node && entry.body)

  // A call begins with a fixed-left pair. Observation stops there and returns
  // its right side. A continued partial call rebuilds its application pairs.
  const startCall = (graph, definition, priorArguments = []) => {
    const answer = []
    answer[0] = answer
    legend.push({ node: answer, symbol: definition.symbol })

    const call = { answer, definition, arguments: [...priorArguments] }
    let pair = answer
    for (const argument of call.arguments)
      pair = [pair, argument]
    graph[0] = pair
    stack.push(call)
    return call
  }

  // Find an unfinished call whose current result is this node.
  const partialFor = node =>
    stack.find(entry =>
      entry.answer?.[1] === node &&
      entry.arguments.length < entry.definition.parameters.length)

  const walk = (tree, replacements) => {
    let graph, left, right, definition

    if (replacements) {
      // Copy a definition body, replacing its parameter identities.
      const replacement = replacements.find(([from]) => tree === from)
      const node = replacement?.[1] ?? tree
      const reference = definitionFor(node)
      const partial = partialFor(node)

      // Shared identities are leaves. Keep them instead of copying them.
      if (replacement || tree[0] === tree || reference || partial)
        return { graph: node, reference, partial }

      const children = tree.map(node => walk(node, replacements))
      left = children[0]
      right = children[1]
      graph = [left.graph, right.graph]
    } else {
      // Without replacements, link the parsed tree itself in place.
      graph = tree
      const scopeStart = stack.length
      const isSignature = tree.every(isSymbol)
      // Calls are built only after the surrounding definition has closed.
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
          // Its complete definition pair does not exist yet, so remember
          // where this reference must be repaired when the body closes.
          if (entry.parameters && !entry.body)
            entry.references.push([graph, i])
          return {
            reference: i === 0 && entry.body && !defining && entry
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

    // Carry a call outward along the left side, start one at a definition,
    // or continue an unfinished call when another argument follows it.
    const call = left.call ??
      (left.reference
        ? startCall(graph, left.reference)
        : left.partial && startCall(
          graph,
          left.partial.definition,
          left.partial.arguments))

    if (call) {
      // The right child of this pair is the call's next argument.
      call.arguments.push(graph[1])
      const arity = call.definition.parameters.length

      if (call.arguments.length < arity) {
        // A partial call observes as itself.
        call.answer[1] = graph
      } else if (call.arguments.length === arity) {
        // Argument equality here is shared pair identity.
        const prior = stack.find(entry =>
          entry !== call &&
          entry.definition === call.definition &&
          entry.arguments?.length === arity &&
          entry.arguments.every((argument, i) =>
            argument === call.arguments[i]))

        if (prior) {
          // Recursive call: Reuse the answer already being constructed.
          call.answer[1] = prior.answer
        } else {
          // Complete call: Copy its body with the parameters replaced.
          const replacements =
            call.definition.parameters.map((parameter, i) =>
              [parameter, call.arguments[i]])
          call.answer[1] = walk(call.definition.body, replacements).graph
        }
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
