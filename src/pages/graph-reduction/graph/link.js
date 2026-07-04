import { parse } from './parse.js'

export const link = source => {
  const stack = [new Map()]
  const legend = []
  const isSymbol = node => !Array.isArray(node)

  const atom = () => {
    const node = []
    node[0] = node[1] = node
    return node
  }

  const remember = (scope, entry) => {
    scope.set(entry.symbol, entry)
    legend.push(entry)
    return entry
  }

  const cachedEntry = symbol => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i].get(symbol)
      if (entry) return entry
    }
  }

  const entryFor = symbol => {
    const cached = cachedEntry(symbol)
    if (cached) {
      if (!cached.node) {
        cached.node = atom()
        legend.push(cached)
      }
      return cached
    }

    const scope = stack.length > 1 ? stack.at(-2) : stack[0]
    return remember(scope, {
      node: atom(),
      symbol,
      slots: []
    })
  }

  const connect = (parent, i, symbol) => {
    const entry = entryFor(symbol)
    entry.slots.push([parent, i])
    parent[i] = entry.node
  }

  const signatureOf = tree => {
    const params = []
    let pair = tree[0]

    while (Array.isArray(pair) && isSymbol(pair[1])) {
      if (params.some(({ symbol }) => symbol === pair[1])) return
      params.push({ pair, symbol: pair[1] })
      pair = pair[0]
    }

    if (isSymbol(pair))
      return { name: pair, pair: params.at(-1)?.pair, params }
  }

  const contains = (tree, symbols) =>
    isSymbol(tree)
      ? symbols.has(tree)
      : contains(tree[0], symbols) || contains(tree[1], symbols)

  const definitionOf = tree => {
    const signature = signatureOf(tree)
    const localName = stack.length > 1 && stack.at(-1).has(signature?.name)
    if (!signature || localName) return

    const params = new Set(signature.params.map(({ symbol }) => symbol))
    return contains(tree[1], params) ? signature : undefined
  }

  const define = (tree, { name, pair, params }) => {
    const scope = new Map(params.map(({ symbol }) =>
      [symbol, { symbol, slots: [] }]))
    const outer = stack.at(-1)
    stack.push(scope)

    // Body occurrences introduce the parameter atoms.
    if (isSymbol(tree[1]))
      connect(tree, 1, tree[1])
    else
      walk(tree[1])

    // Walk backward through the signature, reusing the body identities.
    for (const param of params)
      connect(param.pair, 1, param.symbol)

    stack.pop()

    // The definition closes its local set and resolves later outer references.
    let entry = outer.get(name)
    if (!entry)
      entry = remember(outer, { symbol: name, slots: [] })
    entry.slots.push([pair, 0])
    entry.node = tree
    for (const [parent, i] of entry.slots)
      parent[i] = tree
  }

  const walk = tree => {
    const definition = definitionOf(tree)
    if (definition) {
      define(tree, definition)
      return tree
    }

    // Walk right to left so references precede the identities that bind them.
    for (const i of [1, 0]) {
      const node = tree[i]
      if (isSymbol(node))
        connect(tree, i, node)
      else
        walk(node)
    }

    return tree
  }

  try {
    const graph = walk(parse(source)[0])
    return {
      graph,
      legend: legend.map(({ node, symbol }) => ({ node, symbol }))
    }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
