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

const tokenize = source =>
  clean(source)
    .match(/[()]|[^()\s]+/g) ?? []

export const parse = source => {
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

export const serialize = pair => {
  if (Array.isArray(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${serialize(pair[0])} ${serialize(pair[1])})`
  }

  return String(pair)
}

// Resolve De Bruijn-like indices (as non-negative integers) against an
// application spine, but with indices in *fill order*:
// `(((f x) y) z)` makes an environment `[x, y, z]`, so `0 -> x`, `1 -> y`,
// `2 -> z`, etc.
//
// Extra arguments *outside* the motif are preserved by the schedule: a term
// like `((((((0 2) (1 2)) a) b) c) d)` resolves its left child first, yielding
// `(((a c) (b c)) d)`.
//
// Example (S): `(((((0 2) (1 2)) a) b) c)` resolves to `((a c) (b c))` and
// shares `c` by reference when `c` is a compound pair.
//
export const resolve = term => {
  // Walk a term and report the largest De Bruijn index it mentions.
  // `-1` means "no indices here", so no environment is required.
  const maxIndex = node => {
    if (typeof node === 'number' && Number.isInteger(node) && node >= 0) {
      return node
    }

    // Atoms and `()` do not demand any arguments.
    if (!Array.isArray(node) || node.length === 0) return -1
    if (node.length !== 2) throw new Error('Lists must be empty or pairs')
    return Math.max(maxIndex(node[0]), maxIndex(node[1]))
  }

  // A motif/template is an expression made only of:
  // - indices (non-negative integers)
  // - `()` (empty list)
  // - pairs of motifs
  //
  // Motifs do not contain symbols like `a`, `b`, `c` directly; those are
  // runtime arguments.
  const isMotif = node => {
    if (typeof node === 'number' && Number.isInteger(node) && node >= 0)
      return true
    if (!Array.isArray(node)) return false
    if (node.length === 0) return true
    if (node.length !== 2) throw new Error('Lists must be empty or pairs')
    return isMotif(node[0]) && isMotif(node[1])
  }

  // Substitute indices in a motif using an environment.
  // This is pure (no mutation). Shared arguments remain shared by identity
  // because we reuse `env[n]` references directly.
  const instantiate = (node, env) => {
    if (typeof node === 'number' && Number.isInteger(node) && node >= 0)
      return env[node]

    if (!Array.isArray(node) || node.length === 0) return node
    if (node.length !== 2) throw new Error('Lists must be empty or pairs')
    return [instantiate(node[0], env), instantiate(node[1], env)]
  }

  // Try to resolve *at this node* (outermost), without descending.
  const resolveHere = node => {
    if (!Array.isArray(node) || node.length !== 2) return node

    // Peel application nodes until we hit a motif (template) in function
    // position. This yields:
    // - `body`: the motif
    // - `args`: the arguments applied to it, in fill order
    const args = []
    let body = node
    while (Array.isArray(body) && body.length === 2 && !isMotif(body)) {
      args.unshift(body[1])
      body = body[0]
    }

    if (!isMotif(body)) return node

    const arity = maxIndex(body) + 1
    if (arity === 0) return node

    // A resolve-redex is exactly "motif applied to arity args".
    // If there are extra args, this node is not the redex; the redex is
    // strictly inside the left child.
    if (args.length !== arity) return node

    const env = args
    return instantiate(body, env)
  }

  const reduced = resolveHere(term)
  if (reduced !== term) return reduced

  // Leftmost-outermost schedule: only descend into the left branch.
  if (!Array.isArray(term) || term.length !== 2) return term
  const [left, right] = term
  const nextLeft = resolve(left)
  return nextLeft === left ? term : [nextLeft, right]
}
