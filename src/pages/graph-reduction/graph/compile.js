import { log, parse } from './parse.js'

export const compile = source => {
  const stack = []
  const isSymbol = node => !Array.isArray(node)
  const hasOnlySymbols = parent => parent.every(isSymbol)

  const createNode = (parent, i, symbol) => {
    const node = parent[i] = []
    node[0] = node[1] = node
    stack.push({ node, symbol })
  }

  const bind = (entry, form) => {
    entry.node = form
    entry.parent[entry.index] = form
    return entry
  }

  const link = parent => {
    const mark = stack.length
    let leftSignature, rightSignature, signature

    parent.forEach((node, i) => {
      const index = stack.findLastIndex(({ symbol }) => node === symbol)
      const entry = stack[index]
      const isSignature = hasOnlySymbols(parent)
      const isLocal =
        (signature && isSignature)
        || (leftSignature && i === 1 && index < mark)

      if (Array.isArray(node)) {
        const childSignature = link(node)
        if (i === 0) leftSignature = childSignature
        else rightSignature = childSignature
      } else if (i === 0 && isSignature && !entry) {
        signature = { node: parent, symbol: node, parent, index: i }
        stack.push(signature)
      } else if (entry && !isLocal) {
        parent[i] = entry.node
      } else {
        createNode(parent, i, node)
      }
    })

    return leftSignature && !rightSignature
      ? bind(leftSignature, parent)
      : signature
  }

  try {
    const ast = parse(source)[0]
    link(ast)
    const legend = stack.map(({ node, symbol }) => [node, symbol])
    return log({ graph: ast, legend })
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
