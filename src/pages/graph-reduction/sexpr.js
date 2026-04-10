/**
 * @module sexpr
 *
 * Parsing, serialization, and De Bruijn slot substitution for binary
 * S-expressions encoded as nested JS arrays.
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
 * - Building terms by replacing numeric leaves with reverse De Bruijn slots
 *   collected from the surrounding left-associated application spine
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */


const isPair = node => Array.isArray(node) && node.length === 2

const atom = token => {
  const number = Number(token)
  return Number.isNaN(number) ? token : number
}

const read = (tokens, i = 0) => {
  if (i >= tokens.length) throw new Error('Unexpected EOF while reading')

  const token = tokens[i]
  if (token === ')') throw new Error('Unexpected )')
  if (token !== '(') return [atom(token), i + 1]
  if (i + 1 >= tokens.length) throw new Error('Missing )')
  if (tokens[i + 1] === ')') return [[], i + 2]

  const [left, j] = read(tokens, i + 1)
  const [right, k] = read(tokens, j)

  if (k >= tokens.length) throw new Error('Missing )')
  if (tokens[k] !== ')') throw new Error('Lists must have exactly 2 elements')
  return [[left, right], k + 1]
}

/**
 * Parses a binary S-expression into nested JS arrays, numbers, and strings.
 *
 * Returns the thrown error after logging it, to preserve the current parser
 * contract used by the tests.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const parse = source => {
  try {
    const tokens = source.replace(/;.*$/gm, '').match(/[()]|[^()\s]+/g) ?? []
    if (!tokens.length) return []

    const [pair, i] = read(tokens)
    if (i !== tokens.length) throw new Error('Extra content after expression')
    return pair
  }
  catch (error) {
    console.error(error)
    return error
  }
}

/**
 * Serializes a parsed term back to canonical binary S-expression form.
 *
 * @param {*} pair
 * @returns {string}
 */
export const serialize = pair => {
  if (Array.isArray(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${serialize(pair[0])} ${serialize(pair[1])})`
  }

  return String(pair)
}

/**
 * Replaces numeric leaves in the application head with arguments gathered from
 * the surrounding application spine, treating numbers as reverse De Bruijn
 * slots. Unused outer arguments are reapplied around the built result.
 *
 * @param {*} expr
 * @returns {*}
 */
export const build = expr => {
  const slots = node => {
    if (typeof node === 'number') return node
    if (!isPair(node)) return -1
    return Math.max(slots(node[0]), slots(node[1]))
  }

  const hasSlots = node => slots(node) >= 0

  const unapply = node =>
    isPair(node) && !hasSlots(node[1])
      ? (([head, args]) => [head, [...args, node[1]]])(unapply(node[0]))
      : [node, []]

  const fill = (node, args) => {
    if (typeof node === 'number') {
      if (node >= args.length) throw new Error(`Unbound slot: ${node}`)
      return args[node]
    }
    if (!isPair(node)) return node
    return [fill(node[0], args), fill(node[1], args)]
  }

  const [head, args] = unapply(expr)
  if (!args.length) return expr

  const used = slots(head) + 1
  return args.slice(used).reduce((built, arg) => [built, arg], fill(head, args))
}
