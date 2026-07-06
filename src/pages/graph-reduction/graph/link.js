import { parse as defaultParser } from './parse.js'

export const link = (source, parser = defaultParser) => {
  // Fold each source list left before the graph walk begins.
  const pair = items =>
    items.length
      ? items.slice(1).reduce((left, right) => [left, right], items[0])
      : []

  const fold = tree =>
    Array.isArray(tree) ? pair(tree.map(fold)) : tree

  // The same stack holds identities, their names, and calls under construction.
  const stack = []
  // Names describe graph identities but are not part of the graph.
  const legend = []
  // () refers to the pair that directly contains it.
  const isEnclosure = node => Array.isArray(node) && !node.length

  const named = symbol =>
    stack.findLast(entry => entry.symbol === symbol)

  const bind = (node, symbol) => {
    const entry = { node, symbol }
    stack.push(node, entry)
    legend.push(entry)
    return entry
  }

  // A parameter or free name becomes a graph-native atom.
  const identify = symbol => {
    const node = []
    node[0] = node[1] = node
    return bind(node, symbol)
  }

  const definitionFor = node =>
    stack.includes(node) && node[0] !== node && node

  const partialFor = node =>
    stack.find(entry =>
      entry.answer?.[1] === node
      && entry.arguments.length < entry.parameters.length)

  const startCall = (graph, definition, priorArguments = []) => {
    // Observation stops at this fixed-left pair and returns its right side.
    const answer = []
    answer[0] = answer
    const name = legend.find(entry => entry.node === definition)
    if (name) legend.push({ node: answer, symbol: name.symbol })

    const parameters = []
    for (let pair = definition[0]; pair !== definition; pair = pair[0])
      parameters.unshift(pair[1])
    const call = {
      answer,
      definition,
      parameters,
      arguments: [...priorArguments]
    }
    let pair = answer
    for (const argument of call.arguments)
      pair = [pair, argument]
    graph[0] = pair
    stack.push(call)
    return call
  }

  const walk = (tree, replacements, defining = false) => {
    let graph, left, right

    if (!Array.isArray(tree)) {
      const entry = named(tree) ?? identify(tree)
      const { node } = entry
      return {
        graph: node,
        reference: node[0] !== node && !defining && node
      }
    }

    if (replacements) {
      // Calls copy bodies, but identities and existing calls remain shared.
      const replacement = replacements.find(([from]) => tree === from)
      const node = replacement?.[1] ?? tree
      const reference = definitionFor(node)
      const partial = partialFor(node)

      if (replacement
          || node[0] === node && node[1] === node
          || reference || partial)
        return { graph: node, reference, partial }
    }

    graph = replacements ? [] : tree
    // Empty and already-linked self references become the current pair.
    left = isEnclosure(tree[0]) || tree[0] === tree
      ? { graph }
      : walk(tree[0], replacements, defining)
    right = isEnclosure(tree[1]) || tree[1] === tree
      ? { graph }
      : walk(tree[1], replacements, defining)
    graph[0] = left.graph
    graph[1] = right.graph

    const call = left.call
      ?? (left.reference
        ? startCall(graph, left.reference)
        : left.partial && startCall(
          graph,
          left.partial.definition,
          left.partial.arguments))

    if (call) {
      call.arguments.push(graph[1])
      const arity = call.parameters.length

      if (call.arguments.length < arity) {
        // An incomplete call remains visible until another argument follows.
        call.answer[1] = graph
      } else if (call.arguments.length === arity) {
        const prior = stack.find(entry =>
          entry !== call
          && entry.definition === call.definition
          && entry.arguments?.length === arity
          && entry.arguments.every((argument, i) =>
            argument === call.arguments[i]))

        if (prior) {
          // Reusing an active call ties recursion into a finite cycle.
          call.answer[1] = prior.answer
        } else {
          // A new complete call copies its body with argument identities.
          const replacements =
            call.parameters.map((parameter, i) =>
              [parameter, call.arguments[i]])
          call.answer[1] = walk(call.definition[1], replacements).graph
        }
      } else {
        // Arguments after a complete call apply to its answer.
        call.answer[1] = walk([call.answer[1], graph[1]], []).graph
      }
    }

    return { graph, call }
  }

  // The raw signature tells us which names belong to this definition.
  const walkDefinition = (tree, [name, ...parameters]) => {
    const scopeStart = stack.length
    const entry = bind(tree, name)
    for (const parameter of parameters)
      identify(parameter)
    walk(tree, undefined, true)
    // Parameters leave scope while the completed definition remains.
    stack.length = scopeStart
    stack.push(tree, entry)
  }

  try {
    const [sourceDefinitions, sourceFocus] = parser(source)
    // Fold definitions separately so their raw signatures remain available.
    const definitions = sourceDefinitions.map(definition => fold(definition))
    definitions.forEach((definition, i) =>
      walkDefinition(definition, sourceDefinitions[i][0]))
    const graph = []
    graph[0] = definitions.length ? pair(definitions) : graph
    graph[1] = walk(fold(sourceFocus)).graph
    return { graph, legend }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
