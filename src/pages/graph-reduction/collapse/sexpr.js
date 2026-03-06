/**
 * @module collapse/sexpr
 *
 * Minimal S-expression parser.
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
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

/**
 * Read one expression from a token stream (mutates `tokens`).
 * @param {string[]} tokens
 * @returns {string | number | any[]}
 */
const read = tokens => {
  if (!tokens.length) throw new Error('Unexpected EOF while reading')
  const token = tokens.shift()
  if (typeof token !== 'string') throw new Error('Unexpected EOF while reading')

  if (token === '(') {
    const list = []
    while (tokens[0] !== ')') {
      list.push(read(tokens))
      if (!tokens.length) throw new Error('Missing )')
    }
    tokens.shift()
    return list
  }

  if (token === ')') throw new Error('Unexpected )')
  if (!Number.isNaN(Number(token))) return Number(token)
  return token
}

/**
 * Parse a single S-expression.
 * @param {string} source
 * @returns {string | number | any[] | null}
 */
export const parseSexpr = source => {
  const tokens = tokenize(source)
  if (!tokens.length) return null
  const expr = read(tokens)

  console.log('parseSexpr', { source, expr })

  if (tokens.length) throw new Error('Extra content after expression')
  return expr
}

