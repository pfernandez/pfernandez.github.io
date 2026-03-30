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

export const serialize = pair =>
  Array.isArray(pair)
    ? pair.length ? `(${serialize(pair[0])} ${serialize(pair[1])})` : '()'
    : pair

