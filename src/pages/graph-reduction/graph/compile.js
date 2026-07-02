import { log, parse } from './parse.js'

export const link = tree => {
  const stack = []
  const legend = []
  const isSymbol = node => !Array.isArray(node)

  const remember = entry => (
    stack.push(entry),
    legend.push(entry.name),
    entry)

  const createNode = (parent, i, symbol) => {
    const node = parent[i] = []
    node[0] = node[1] = node
    return remember({ node, symbol, name: [node, symbol] })
  }

  const createSignature = (parent, i, symbol) =>
    remember({ node: parent, symbol, name: [parent, symbol], parent, index: i })

  const bind = (entry, form) => {
    entry.node = form
    entry.parent[entry.index] = form
    entry.name[0] = form
    return entry
  }

  const walk = source => {
    const graph = []
    const mark = stack.length
    let leftSignature, rightSignature, signature, hasNewRightLocal

    source.forEach((node, i) => {
      const entry = stack.findLast(({ symbol }) => node === symbol)
      const isSignature = parent => parent.every(isSymbol)

      if (!isSymbol(node)) {
        const child = walk(node)
        graph[i] = child.graph
        if (i === 0) leftSignature = child.signature
        else rightSignature = child.signature
      } else if (i === 0 && isSignature && !entry) {
        signature = createSignature(graph, i, node)
      } else if (entry) {
        graph[i] = entry.node
      } else {
        createNode(graph, i, node)
        hasNewRightLocal ||= i === 1 && leftSignature
      }
    })

    const result = leftSignature && !rightSignature
      ? bind(leftSignature, graph)
      : signature

    if (leftSignature && result && !hasNewRightLocal) {
      stack.length = mark
      stack.push(result)
    }

    return { graph, signature: result }
  }

  return { graph: walk(tree).graph, legend }
}

export const compile = source => {
  try {
    const tree = parse(source)[0]
    return log(link(tree))
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
