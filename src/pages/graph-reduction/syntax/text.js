const parse = source => {
  const tokens =
    [...source.matchAll(/(;.*$)|[()]|[^()\s]+/gm)]
      .filter(match => !match[1])
      .map(match => match[0])
  let index = 0

  const read = () => {
    const token = tokens[index++]
    if (token !== '(') {
      if (token === ')') throw new Error('Unexpected )')
      return token
    }

    const items = []
    while (index < tokens.length && tokens[index] !== ')')
      items.push(read())
    if (index >= tokens.length) throw new Error('Missing )')
    index += 1
    if (items.length && items.length !== 2)
      throw new Error('Expressions must be pairs')
    return items
  }

  const tree = read()
  if (index < tokens.length) throw new Error('Unexpected expression')
  return tree
}

const reference = depth => {
  let tree = []
  for (let i = 0; i <= depth; i++)
    tree = [tree]
  return tree
}

export const compile = source => {
  const stack = []
  const legend = []
  const applications = []

  const walk = tree => {
    if (!Array.isArray(tree)) {
      const index = stack.findLastIndex(entry => entry.symbol === tree)
      if (index < 0) throw new Error(`Undefined name: ${tree}`)
      return {
        node: reference(stack.length - index - 1),
        symbol: tree
      }
    }
    if (!tree.length) return { node: [] }

    const symbol = tree[0]
    if (!Array.isArray(symbol)
        && !stack.some(entry => entry.symbol === symbol)) {
      const scopeStart = stack.length
      const entry = { symbol }
      stack.push(entry)
      legend.push(entry)
      entry.node = walk(tree[1]).node
      stack.length = scopeStart
      stack.push(entry)
      return { node: [entry.node], symbol }
    }

    const left = walk(tree[0])
    const right = walk(tree[1])
    const node = [left.node, right.node]
    if (left.symbol)
      applications.push({ node, symbol: left.symbol })
    return { node, symbol: left.symbol }
  }

  const decorate = () => {
    const known = new Set(legend.map(entry => entry.node))
    const answers = []
    for (const application of applications) {
      const node = application.node[0]
      if (node[0] === node && !known.has(node)) {
        known.add(node)
        answers.push({ node, symbol: application.symbol })
      }
    }
    return answers
  }

  return { source: walk(parse(source)).node, legend, decorate }
}
