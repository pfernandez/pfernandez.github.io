import { parse } from './parse.js'

export const link = source => {
  const stack = []
  const isSymbol = node => !Array.isArray(node)

  const createNode = (parent, i, symbol) => {
    const node = parent[i] = []
    node[0] = node[1] = node
    const entry = { node, symbol, name: [node, symbol], variables: [] }
    stack.push(entry)
    return entry
  }

  const startDefinition = (parent, i, symbol) => {
    const entry = {
      node: parent,
      symbol,
      name: [parent, symbol],
      variables: [],
      parent,
      index: i
    }
    stack.push(entry)
    return entry
  }

  const completeDefinition = (entry, form) => {
    entry.node = form
    entry.parent[entry.index] = form
    entry.name[0] = form
    return entry
  }

  const walk = tree => {
    const graph = []
    const mark = stack.length
    const isSignature = tree.every(isSymbol)
    let leftDefinition, rightDefinition, definition, hasNewParameter

    tree.forEach((node, i) => {
      const entry = stack.findLast(({ symbol }) => node === symbol)

      if (!isSymbol(node)) {
        const child = walk(node)
        graph[i] = child.graph
        if (i === 0) leftDefinition = child.definition
        else rightDefinition = child.definition
      } else if (i === 0 && isSignature && !entry) {
        definition = startDefinition(graph, i, node)
      } else if (entry) {
        graph[i] = entry.node
      } else {
        const variable = createNode(graph, i, node)
        const owner = isSignature ? definition : leftDefinition

        if (owner) owner.variables.push(variable.name)
        hasNewParameter ||= i === 1 && leftDefinition
      }
    })

    const result = leftDefinition && !rightDefinition
      ? completeDefinition(leftDefinition, graph)
      : definition

    if (leftDefinition && result && !hasNewParameter) {
      stack.length = mark
      stack.push(result)
    }

    return { graph, definition: result }
  }

  try {
    return {
      graph: walk(parse(source)[0]).graph,
      legend: stack.flatMap(({ name, variables }) => [name, ...variables])
    }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
