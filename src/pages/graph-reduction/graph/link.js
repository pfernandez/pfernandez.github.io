import { parse } from './parse.js'

export const link = source => {
  // The same stack holds identity pairs and calls under construction.
  const stack = []
  // () refers to the pair that directly contains it.
  const isEnclosure = node => Array.isArray(node) && !node.length

  // Unary enclosures ending in () count outward through the identity stack.
  const referenceDepth = tree => {
    let depth = 0
    while (Array.isArray(tree) && tree.length === 1) {
      tree = tree[0]
      if (isEnclosure(tree)) return depth
      depth += 1
    }
  }

  const referenceAt = depth => {
    for (let i = stack.length - 1; i >= 0; i--)
      if (Array.isArray(stack[i]) && depth-- === 0)
        return stack[i]
  }

  const definitionFor = node =>
    stack.includes(node) && node[0] !== node && node

  const partialFor = node =>
    stack.find(entry =>
      entry.answer?.[1] === node &&
      entry.arguments.length < entry.parameters.length)

  const startCall = (graph, definition, priorArguments = []) => {
    // Observation stops at this fixed-left pair and returns its right side.
    const answer = []
    answer[0] = answer

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
    } else {
      const depth = referenceDepth(tree)
      if (depth !== undefined) {
        const node = referenceAt(depth)
        return {
          graph: node,
          reference: node[0] !== node && !defining && node
        }
      } else if (tree.length === 1) {
        // Every other unary form binds its contents to the current scope.
        const scopeStart = stack.length
        const graph = tree[0]
        stack.push(graph)
        walk(graph, undefined, true)
        // Inner identities leave scope while the outer identity remains.
        stack.length = scopeStart
        stack.push(graph)
        return { graph }
      }
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

    const call = left.call ??
      (left.reference
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

  try {
    const graph = walk(parse(source)[0]).graph
    return { graph, legend: [] }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
