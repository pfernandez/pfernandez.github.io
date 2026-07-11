import { parse } from './parse.js'

export const link = source => {
  // A list folds left. If its first entry is a new symbol, that symbol names
  // the whole folded form. Later new symbols become graph-native atoms.
  // The same stack holds identities, their names, and calls under construction.
  const stack = []

  // The graph contains only arrays. Names stay here for lookup and display.
  const legend = []

  const named = symbol =>
    stack.findLast(entry => entry.symbol === symbol)

  const bind = (node, symbol) => {
    const entry = { node, symbol }
    stack.push(node, entry)
    legend.push(entry)
    return entry
  }

  // A later new name becomes a graph-native atom.
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
          call.answer[1] = walk(call.definition[1], replacements).graph
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

  const startCall = (graph, definition, priorArguments = []) => {
    // The call rewrites this pair as a redex on the left and its next state
    // on the right, so a machine step can stay a plain right-edge projection.
    const answer = []
    answer[0] = answer
    const name = legend.find(entry => entry.node === definition)
    if (name) legend.push({ node: answer, symbol: name.symbol })

    // Definition parameters are the right branches of the left spine.
    const parameters = []
    for (let pair = definition[0]; pair !== definition; pair = pair[0])
      parameters.unshift(pair[1])

    const call =
      { answer, definition, parameters, arguments: [...priorArguments] }

    let pair = answer
    for (const argument of call.arguments) pair = [pair, argument]

    graph[0] = pair
    stack.push(call)
    return call
  }

  const walk = (tree, replacements, defining = false) => {
    if (!Array.isArray(tree)) {
      const entry = named(tree) ?? identify(tree)
      const { node } = entry
      return { graph: node,
               reference: node[0] !== node && !defining && node }
    }

    if (!replacements) {
      if (tree.length === 1) return walk(tree[0], undefined, defining)

      const length = tree.length
      const graph = tree
      const scopeStart = stack.length
      const entry =
        !Array.isArray(tree[0]) && !named(tree[0]) && bind(graph, tree[0])

      let result
      tree.forEach((node, i) => {
        const buildingName = Boolean(entry) && (i === 0 || length > 2)
        const child = walk(node, undefined, defining || buildingName)
        result = i
          ? finish(i === length - 1 ? tree : [], result, child)
          : child
      })

      if (entry) {
        // Local parameter names leave scope; the named form remains.
        stack.length = scopeStart
        stack.push(graph, entry)
      }

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
    return { graph: walk(parse(source)).graph, legend }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
