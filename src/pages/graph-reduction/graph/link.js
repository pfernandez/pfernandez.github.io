import { err, parse } from './parse.js'

export const link = source => {
  // The same stack holds visible names, definition metadata, and calls that
  // are being copied. Names are only construction/display handles; the graph
  // itself is made only of pairs.
  const stack = []
  const legend = []

  const named = symbol =>
    stack.findLast(entry => entry.symbol === symbol)

  const bind = (node, symbol) => {
    const entry = { node, symbol, label: { node, symbol } }
    stack.push(node, entry)
    legend.push(entry.label)
    return entry
  }

  // An unseen non-left name is an atom: both edges point back to itself.
  const identify = symbol => {
    const node = []
    node[0] = node[1] = node
    return bind(node, symbol)
  }

  // Definition parameters are the right-edge atoms along the definition's left
  // spine. They are returned in the order arguments arrive.
  const parametersOf = node =>
    node[0] === node ? [node] : [...parametersOf(node[0]), node[1]]

  const definitionFor = node =>
    stack.find(entry => entry.node === node && entry.parameters)

  const partialFor = node =>
    stack.find(entry =>
      entry.answer?.[1] === node
      && entry.arguments.length < entry.parameters.length)

  const startCall = (graph, entry, priorArguments = []) => {
    // A call owns an answer node. When enough arguments arrive, the answer's
    // right edge is wired to a body copy.
    const answer = []
    answer[0] = answer
    legend.push({ node: answer, symbol: entry.symbol })

    const call = {
      answer,
      definition: entry,
      parameters: entry.parameters,
      arguments: [...priorArguments]
    }

    let pair = answer
    for (const argument of call.arguments) pair = [pair, argument]

    graph[0] = pair
    stack.push(call)
    return call
  }

  const finish = (graph, left, right) => {
    graph[0] = left.graph
    graph[1] = right.graph
    graph.length = 2

    const call = left.call ?? (
      left.reference
        ? startCall(graph, left.reference)
        : left.partial &&
          startCall(graph, left.partial.definition, left.partial.arguments))

    if (!call) return { graph }

    const argument = graph[1]
    call.arguments.push(argument)
    const arity = call.parameters.length

    if (call.arguments.length < arity) {
      // A partial application stays visible until another argument follows.
      call.answer[1] = graph
    } else if (call.arguments.length === arity) {
      const prior = stack.find(entry =>
        entry !== call
        && entry.definition === call.definition
        && entry.arguments?.length === arity
        && entry.arguments.every(
          (argument, i) => argument === call.arguments[i]))

      if (prior) {
        // A repeated active call shares the existing answer and ties recursion.
        call.answer[1] = prior.answer
      } else {
        // A complete call copies the body with parameter identities replaced.
        const replacements = call.parameters.map(
          (parameter, i) => [parameter, call.arguments[i]])
        call.answer[1] = walk(call.definition.node[1], replacements).graph
      }
    } else {
      // Extra arguments apply to the completed answer.
      call.answer[1] = walk([call.answer[1], argument], []).graph
    }

    let pair = call.answer
    for (const argument of call.arguments) pair = [pair, argument]

    graph[0] = pair
    graph[1] = call.answer[1]
    return { graph, call }
  }

  const walk = (tree, replacements, defining = false) => {
    if (!Array.isArray(tree)) {
      const entry = named(tree) ?? identify(tree)
      const { node } = entry
      return { graph: node, reference: !defining && definitionFor(node) }
    }

    if (!tree.length) err('Unexpected ()')

    if (!replacements) {
      if (tree.length === 1) return walk(tree[0], undefined, defining)

      const length = tree.length
      const graph = tree
      const scopeStart = stack.length

      // A new leftmost symbol names the form that follows it. For a binary
      // wrapper like (Loop body), binding directly to body lets self-references
      // inside body point at the final pair instead of at the discarded label.
      const entry =
        !Array.isArray(tree[0]) && !named(tree[0]) &&
        bind(length === 2 && Array.isArray(tree[1]) ? tree[1] : graph, tree[0])

      let result
      tree.forEach((node, i) => {
        if (entry && i === 0) return
        const buildingName = Boolean(entry) && length > 2
        const child = walk(node, undefined, defining || buildingName)
        result = result
          ? finish(i === length - 1 ? tree : [], result, child)
          : child
      })

      if (entry) {
        stack.length = scopeStart
        entry.label.node = entry.node = result.graph
        if (length > 2) entry.parameters = parametersOf(result.graph[0])
        stack.push(result.graph, entry)
      }

      return result
    }

    // Body copies replace parameter identities but keep existing complete
    // identities, definitions, partials, and cycles shared.
    const replacement = replacements.find(([from]) => tree === from)
    const node = replacement?.[1] ?? tree
    const reference = definitionFor(node)
    const partial = partialFor(node)

    if (replacement
        || node[0] === node && node[1] === node
        || reference || partial)
      return { graph: node, reference, partial }

    const graph = []
    const left = tree[0] === tree
      ? { graph }
      : walk(tree[0], replacements, defining)
    const right = tree[1] === tree
      ? { graph }
      : walk(tree[1], replacements, defining)

    return finish(graph, left, right)
  }

  try {
    const forms = parse(source)
    if (forms.length > 1) err('Expected one expression')
    return { graph: walk(forms[0]).graph, legend }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
