import { parse } from './parse.js'

export const link = source => {
  // A pair whose left side is a new signature names a definition.
  // Other lists fold left. Later new symbols become atoms.
  // The same stack holds identities, names, and calls under construction.
  const stack = []

  // The graph contains only arrays. Names stay here for lookup and display.
  const legend = []

  const named = symbol =>
    stack.findLast(entry => entry.symbol === symbol)

  const bind = (node, symbol) => {
    const entry = { node, symbol, label: { node, symbol } }
    stack.push(node, entry)
    legend.push(entry.label)
    return entry
  }

  // A later new name becomes a graph-native atom.
  const identify = symbol => {
    const node = []
    node[0] = node[1] = node
    return bind(node, symbol)
  }

  const signatureOf = tree => {
    const signature = []

    while (Array.isArray(tree) && tree.length === 2) {
      signature.unshift(tree[1])
      tree = tree[0]
    }

    signature.unshift(tree)
    return signature.length > 1
      && signature.every(symbol => !Array.isArray(symbol))
      && signature
  }

  const applyArgs = args =>
    args.slice(1).reduce((left, right) => [left, right], args[0])

  const definitionFor = node =>
    stack.find(entry => entry.node === node && entry.parameters)

  const partialFor = node =>
    stack.find(entry =>
      entry.answer?.[1] === node
      && entry.arguments.length < entry.parameters.length)

  const finish = (graph, left, right) => {
    graph[0] = left.graph
    graph[1] = right.graph
    graph.length = 2

    const call = left.call ?? (left.reference
      ? startCall(graph, left.reference)
      : left.partial
        && startCall(graph, left.partial.definition, left.partial.arguments))

    if (call) {
      const argument = graph[1]
      call.arguments.push(argument)
      const arity = call.parameters.length

      if (call.arguments.length < arity) {
        // An incomplete call remains visible until another argument follows.
        call.answer[1] = graph
      } else if (call.arguments.length === arity) {
        const prior = stack.find(entry =>
          entry !== call
          && entry.definition === call.definition
          && entry.arguments?.length === arity
          && entry.arguments.every(
            (argument, i) => argument === call.arguments[i]))

        if (prior) {
          // A repeated active call shares its existing answer, tying recursion.
          call.answer[1] = prior.answer
        } else {
          // A new complete call copies its body with argument identities.
          const replacements = call.parameters.map(
            (parameter, i) => [parameter, call.arguments[i]])
          call.answer[1] = walk(call.definition.node[1], replacements).graph
        }
      } else {
        // Arguments after a complete call apply to its answer.
        call.answer[1] = walk([call.answer[1], argument], []).graph
      }

      let pair = call.answer
      for (const argument of call.arguments) pair = [pair, argument]

      graph[0] = pair
      graph[1] = call.answer[1]
    }

    return { graph, call }
  }

  const startCall = (graph, entry, priorArguments = []) => {
    // The call rewrites this pair as a redex on the left and its next state
    // on the right, so a machine step can stay a plain right-edge projection.
    const answer = []
    answer[0] = answer
    legend.push({ node: answer, symbol: entry.symbol })

    const call =
      { answer,
        definition: entry,
        parameters: entry.parameters,
        arguments: [...priorArguments] }

    let pair = answer
    for (const argument of call.arguments) pair = [pair, argument]

    graph[0] = pair
    stack.push(call)
    return call
  }

  const walk = (tree, replacements, defining = false, root = false) => {
    if (!Array.isArray(tree)) {
      const entry = named(tree) ?? identify(tree)
      const { node } = entry
      return { graph: node, reference: !defining && definitionFor(node) }
    }

    if (!replacements) {
      if (tree.length === 1) return walk(tree[0], undefined, defining)

      const signature = !root && tree.length === 2 && signatureOf(tree[0])
      if (signature && !named(signature[0])) {
        const graph = tree
        const scopeStart = stack.length
        const entry = bind(graph, signature[0])
        const parameters =
          signature.slice(1).map(symbol => identify(symbol).node)
        const body = walk(tree[1], undefined, true)

        graph[0] = applyArgs(parameters)
        graph[1] = body.graph
        graph.length = 2
        entry.node = entry.label.node = graph
        entry.parameters = parameters

        stack.length = scopeStart
        stack.push(graph, entry)
        return { graph }
      }

      const length = tree.length
      const graph = tree
      let result

      tree.forEach((node, i) => {
        const child = walk(node, undefined, defining)
        result = result
          ? finish(i === length - 1 ? tree : [], result, child)
          : child
      })

      return result
    }

    // Body copies replace parameter identities but share existing identities.
    const replacement = replacements.find(([from]) => tree === from)
    const node = replacement?.[1] ?? tree
    const reference = definitionFor(node)
    const partial = partialFor(node)

    if (replacement
        || node[0] === node && node[1] === node
        || reference || partial)
      return { graph: node, reference, partial }

    const graph = []

    // Already-linked self references become the current pair.
    const left = tree[0] === tree
      ? { graph }
      : walk(tree[0], replacements, defining)

    const right = tree[1] === tree
      ? { graph }
      : walk(tree[1], replacements, defining)

    return finish(graph, left, right)
  }

  try {
    const tree = typeof source === 'string' ? parse(source) : source
    return { graph: walk(tree, undefined, false, true).graph, legend }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
