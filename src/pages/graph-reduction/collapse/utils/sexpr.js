/**
 * @module collapse/sexpr
 *
 * Minimal S-expression parser and serializer.
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

/**
 * @typedef {import('./ast-types').AtomAst} AtomAst
 * @typedef {import('./ast-types').PairAst} PairAst
 */

/**
 * Strip `;` line comments.
 * @param {string} source
 * @returns {string}
 */
const clean = source => source.replace(/;.*$/gm, '')

/**
 * Tokenize an S-expression string into `(`, `)`, and atom tokens.
 * @param {string} source
 * @returns {string[]}
 */
const tokenize = source =>
  clean(source)
    .match(/[()]|[^()\s]+/g) ?? []

/**
 * Parse a single S-expression.
 * @param {string} source
 * @returns {AtomAst}
 */
export const parseSexpr = source => {
  const tokens = tokenize(source)
  if (!tokens.length) return /** @type {PairAst} */ ([])

  let pos = 0
  const read = () => {
    if (pos >= tokens.length) throw new Error('Unexpected EOF while reading')
    const token = tokens[pos++]

    if (token === '(') {
      if (pos >= tokens.length) throw new Error('Missing )')
      if (tokens[pos] === ')') {
        pos++
        return /** @type {PairAst} */ ([])
      }

      const left = read()
      const right = read()
      if (pos >= tokens.length) throw new Error('Missing )')
      if (tokens[pos] !== ')') throw new Error(
        'Lists must have exactly 2 elements')
      pos++
      return /** @type {PairAst} */ ([left, right])
    }

    if (token === ')') throw new Error('Unexpected )')
    const numberToken = Number(token)
    return Number.isNaN(numberToken) ? token : numberToken
  }

  const expr = read()
  if (pos !== tokens.length) throw new Error('Extra content after expression')

  return expr
}

/**
 * @param {AtomAst} ast
 * @returns {string}
 */
export const serializeSexpr = ast => {
  if (Array.isArray(ast)) {
    if (ast.length === 0) {
      return '()'
    }

    if (ast.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    const [left, right] = ast
    return `(${serializeSexpr(left)} ${serializeSexpr(right)})`
  }

  return String(ast)
}
