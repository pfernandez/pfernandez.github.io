import { log, parse } from './parse.js'

export const compile = source => {
  const stack = []
  const legend = []
  const isSymbol = node => !Array.isArray(node)
  const hasOnlySymbols = parent => parent.every(isSymbol)
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

  const link = parent => {
    const mark = stack.length
    let leftSignature, rightSignature, signature, hasNewRightLocal

    parent.forEach((node, i) => {
      const entry = stack.findLast(({ symbol }) => node === symbol)
      const isSignature = hasOnlySymbols(parent)

      if (Array.isArray(node)) {
        const childSignature = link(node)
        if (i === 0) leftSignature = childSignature
        else rightSignature = childSignature
      } else if (i === 0 && isSignature && !entry) {
        signature = createSignature(parent, i, node)
      } else if (entry) {
        parent[i] = entry.node
      } else {
        createNode(parent, i, node)
        hasNewRightLocal ||= i === 1 && leftSignature
      }
    })

    const result = leftSignature && !rightSignature
      ? bind(leftSignature, parent)
      : signature

    if (leftSignature && result && !hasNewRightLocal) {
      stack.length = mark
      stack.push(result)
    }

    return result
  }

  try {
    const ast = parse(source)[0]
    link(ast)
    return log({ graph: ast, legend })
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
