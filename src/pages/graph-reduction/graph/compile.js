import { log, parse } from './parse.js'

export const compile = source => {
  const stack = []
  const legend = []
  const signatures = new Map()
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

  const link = source => {
    const form = []
    const mark = stack.length
    let leftSignature, rightSignature, signature, hasNewRightLocal

    source.forEach((node, i) => {
      const entry = stack.findLast(({ symbol }) => node === symbol)
      const isSignature = hasOnlySymbols(source)

      if (Array.isArray(node)) {
        const child = link(node)
        form[i] = child
        if (i === 0) leftSignature = signatures.get(child)
        else rightSignature = signatures.get(child)
      } else if (i === 0 && isSignature && !entry) {
        signature = createSignature(form, i, node)
      } else if (entry) {
        form[i] = entry.node
      } else {
        createNode(form, i, node)
        hasNewRightLocal ||= i === 1 && leftSignature
      }
    })

    const result = leftSignature && !rightSignature
      ? bind(leftSignature, form)
      : signature

    if (leftSignature && result && !hasNewRightLocal) {
      stack.length = mark
      stack.push(result)
    }

    signatures.set(form, result)
    return form
  }

  try {
    const tree = parse(source)[0]
    const graph = link(tree)
    return log({ graph, legend })
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
