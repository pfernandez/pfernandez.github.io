import { parse } from './parse.js'

export const link = source => {
  // The same stack holds names in scope and calls under construction.
  const stack = []
  // Names are kept beside the graph for display, not stored inside it.
  const legend = []
  const isSymbol = node => !Array.isArray(node)
  // () refers to the pair that directly contains it.
  const isEnclosure = node => Array.isArray(node) && !node.length

  const entryFor = symbol =>
    stack.findLast(entry => entry.symbol === symbol)

  const definitionFor = node =>
    stack.find(entry => entry.node === node && entry.body)

  const partialFor = node =>
    stack.find(entry =>
      entry.answer?.[1] === node &&
      entry.arguments.length < entry.definition.parameters.length)

  const identify = tree => {
    const scopeStart = stack.length
    // An unseen left name points to the complete form on its right.
    const entry = { node: tree[1], symbol: tree[0] }
    stack.push(entry)
    legend.push(entry)

    // Inner names stay in scope while the complete form is linked.
    const graph = walk(entry.node, undefined, true).graph
    entry.node = graph
    const parameters =
      stack.slice(scopeStart + 1).map(({ node }) => node)
    // Then only the outer name remains in the enclosing scope.
    stack.length = scopeStart
    stack.push(entry)

    // An alias shares call metadata as well as pair identity.
    const definition = definitionFor(graph)
    if (definition) {
      entry.parameters = definition.parameters
      entry.body = definition.body
    } else if (graph[0] !== graph) {
      // Every bound form that is not fixed-left is callable.
      entry.parameters = parameters
      entry.body = graph[1]
    }
    return { graph }
  }

  const startCall = (graph, definition, priorArguments = []) => {
    // Observation stops at this fixed-left pair and returns its right side.
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

  const walk = (tree, replacements, defining = false) => {
    let graph, left, right

    if (replacements) {
      // Calls copy bodies, but identities and existing calls remain shared.
      const replacement = replacements.find(([from]) => tree === from)
      const node = replacement?.[1] ?? tree
      const reference = definitionFor(node)
      const partial = partialFor(node)

      if (replacement ||
          (node[0] === node && node[1] === node) ||
          reference || partial)
        return { graph: node, reference, partial }
    } else if (isSymbol(tree)) {
      // A known name becomes its pair identity.
      const entry = entryFor(tree)
      return {
        graph: entry.node,
        reference: entry.body && !defining && entry
      }
    } else if (isSymbol(tree[0]) && !entryFor(tree[0])) {
      // An unknown name on the left introduces the form on the right.
      return identify(tree)
    }

    graph = replacements ? [] : tree
    // An enclosure reference becomes the pair currently being linked.
    left = isEnclosure(tree[0]) || tree[0] === tree
      ? { graph }
      : walk(tree[0], replacements, defining)
    right = isEnclosure(tree[1]) || tree[1] === tree
      ? { graph }
      : walk(tree[1], replacements, defining)
    graph[0] = left.graph
    graph[1] = right.graph

    const call = left.call ??
      (left.reference
        ? startCall(graph, left.reference)
        : left.partial && startCall(
          graph,
          left.partial.definition,
          left.partial.arguments))

    if (call) {
      call.arguments.push(graph[1])
      const arity = call.definition.parameters.length

      if (call.arguments.length < arity) {
        // An incomplete call remains visible until another argument follows.
        call.answer[1] = graph
      } else if (call.arguments.length === arity) {
        const prior = stack.find(entry =>
          entry !== call &&
          entry.definition === call.definition &&
          entry.arguments?.length === arity &&
          entry.arguments.every((argument, i) =>
            argument === call.arguments[i]))

        if (prior) {
          // Reusing an active call ties recursion into a finite cycle.
          call.answer[1] = prior.answer
        } else {
          // A new complete call copies its body with argument identities.
          const replacements =
            call.definition.parameters.map((parameter, i) =>
              [parameter, call.arguments[i]])
          call.answer[1] = walk(call.definition.body, replacements).graph
        }
      } else {
        // Arguments after a complete call apply to its answer.
        call.answer[1] = walk([call.answer[1], graph[1]], []).graph
      }
    }

    return { graph, call }
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
