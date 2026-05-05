export const serialize = graph => {
  const print = (node, path = '$', seen = new Map()) => {
    if (!Array.isArray(node)) return String(node)
    if (!node.length) return '()'
    if (seen.has(node)) return seen.get(node)
    seen.set(node, path)

    const [first, rest] = node
    return `(${print(first, `${path}[0]`, seen)} ${print(rest, `${path}[1]`, seen)})`
  }

  return print(graph)
}
