/**
 * @module sexpr
 *
 * Minimal pair parser and serializer.
 *
 * We intentionally restrict surface S-expressions to a *binary* discipline:
 * every list must be either `()` or a 2-tuple `(a b)`. This keeps the output
 * isomorphic to a full binary tree / pairs encoding.
 *
 * Supported:
 * - Lists: `(a b)` → `['a', 'b']`
 * - Numbers: `42` → `42`
 * - Symbols: everything else as strings
 * - Line comments starting with `;`
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */

const clean = source => source.replace(/;.*$/gm, '')
const tokenize = source => clean(source).match(/[()]|[^()\s]+/g) ?? []

export const parse = source => {
  try {
    const tokens = tokenize(source)
    if (!tokens.length) return []

    let i = 0
    const read = () => {
      if (i >= tokens.length) throw new Error('Unexpected EOF while reading')
      const token = tokens[i++]

      if (token === '(') {
        if (i >= tokens.length) throw new Error('Missing )')
        if (tokens[i] === ')') {
          i++
          return []
        }

        const left = read()
        const right = read()
        if (i >= tokens.length) throw new Error('Missing )')
        if (tokens[i] !== ')')
          throw new Error('Lists must have exactly 2 elements')
        i++
        return [left, right]
      }

      if (token === ')') throw new Error('Unexpected )')
      const numberToken = Number(token)
      return Number.isNaN(numberToken) ? token : numberToken
    }

    const pair = read()
    if (i !== tokens.length) throw new Error('Extra content after expression')

    return pair
  }
  catch (error) {
    console.error(error)
    return error
  }
}

export const serialize = pair => {
  if (Array.isArray(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${serialize(pair[0])} ${serialize(pair[1])})`
  }

  return String(pair)
}

export const build = expr => {
  const slots = node => {
    if (typeof node === 'number') return node
    if (!Array.isArray(node) || !node.length) return -1
    return Math.max(slots(node[0]), slots(node[1]))
  }

  const hasSlots = node => slots(node) >= 0

  const fill = (node, args) => {
    if (typeof node === 'number') {
      if (node >= args.length) throw new Error(`Unbound slot: ${node}`)
      return args[node]
    }
    if (!Array.isArray(node) || !node.length) return node
    node[0] = fill(node[0], args)
    node[1] = fill(node[1], args)
    return node
  }

  const args = []
  let head = expr
  while (Array.isArray(head) && head.length === 2 && !hasSlots(head[1])) {
    args.unshift(head[1])
    head = head[0]
  }

  if (!args.length) return expr

  const used = slots(head) + 1
  let built = fill(head, args)
  for (const arg of args.slice(used)) built = [built, arg]
  return built
}

