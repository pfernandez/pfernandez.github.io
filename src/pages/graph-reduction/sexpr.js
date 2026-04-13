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

const maxSlot = node => {
  if (typeof node === 'number') return node
  if (!isPair(node)) return -1
  return Math.max(maxSlot(node[0]), maxSlot(node[1]))
}

const unapply = node =>
  isPair(node) && maxSlot(node[1]) < 0
    ? (([head, args]) => [head, [...args, node[1]]])(unapply(node[0]))
    : [node, []]

const fill = (node, args) => {
  if (typeof node === 'number') return args[node]
  if (!isPair(node)) return node
  return [fill(node[0], args), fill(node[1], args)]
}

const rebuild = (head, args) =>
  args.reduce((outer, arg) => [outer, arg], head)

const consumeFirst = (node, arg) => {
  if (typeof node === 'number') return node === 0 ? arg : node - 1
  if (!isPair(node)) return node
  return [consumeFirst(node[0], arg), consumeFirst(node[1], arg)]
}

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
 * Replaces numeric leaves in the application head with shared inputs gathered
 * from the surrounding left-associated application spine, treating numbers as
 * reverse De Bruijn slots. Used inputs are consumed by the head; any unused
 * outer inputs remain outside the built result.
 *
 * @param {*} expr
 * @returns {*}
 */
export const build = expr => {
  const [head, args] = unapply(expr)
  if (!args.length) return expr

  const used = maxSlot(head) + 1
  if (used > args.length) throw new Error(`Unbound slot: ${used - 1}`)

  const built = fill(head, args)
  return rebuild(built, args.slice(used))
}

/**
 * Consumes one input from a left-associated motif application.
 *
 * This mirrors the visualizer in `~/basis` more closely than `build`:
 * one step fills one input, reindexes the remaining slots, and leaves the
 * remaining outer inputs in place.
 *
 * @param {*} expr
 * @returns {*}
 */
export const buildOne = expr => {
  const [head, args] = unapply(expr)
  if (!args.length) return expr

  const slot = maxSlot(head)
  if (slot < 0) return expr

  const used = slot + 1
  if (used > args.length) throw new Error(`Unbound slot: ${used - 1}`)

  return rebuild(consumeFirst(head, args[0]), args.slice(1))
}
