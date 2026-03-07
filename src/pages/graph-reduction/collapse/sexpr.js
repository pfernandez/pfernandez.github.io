/**
 * @module collapse/sexpr
 *
 * Minimal S-expression parser and canonical AST used by the collapse
 * interpreter.
 *
 * We intentionally restrict surface S-expressions to a *binary* discipline:
 * every list must be either `()` or a 2-tuple `(a b)`. This keeps the AST
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
import { invariant } from './utils.js'

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
 * Normalize a parsed S-expression into a binary pair AST.
 * @param {any} expr
 * @returns {AtomAst}
 */
export const toPairAst = expr => {
  if (expr == null) return /** @type {PairAst} */ ([])
  if (typeof expr === 'string' || typeof expr === 'number') return expr

  invariant(Array.isArray(expr), 'Expression must be an atom or list')
  if (expr.length === 0) return /** @type {PairAst} */ ([])
  invariant(
    expr.length === 2,
    'Lists must have exactly 2 elements (binary pairs)'
  )
  return /** @type {PairAst} */ ([toPairAst(expr[0]), toPairAst(expr[1])])
}

/**
 * Parse a single S-expression.
 * @param {string} source
 * @returns {AtomAst}
 */
export const parseSexpr = source => {
  const tokens = tokenize(source)
  if (!tokens.length) return null
  const expr = read(tokens)

  console.log('parseSexpr', { source, expr })

  if (tokens.length) throw new Error('Extra content after expression')
  return toPairAst(expr)
}

