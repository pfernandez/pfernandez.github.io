/**
 * A Lisp source value after tokenization and list reading.
 *
 * @typedef {SourceForm[]} SourceFormArray
 * @typedef {string | number | SourceFormArray} SourceForm
 */

const tokenize = source =>
  source.replace(/;.*$/gm, '').match(/[()]|[^()\s]+/g) ?? []

const atom = token => {
  const number = Number(token)
  return Number.isNaN(number) ? token : number
}

const read = (tokens, i = 0) => {
  const token = tokens[i]
  if (token === ')') throw new Error('Unexpected )')
  if (token !== '(') return [atom(token), i + 1]

  const list = []
  let cursor = i + 1

  while (true) {
    if (cursor >= tokens.length) throw new Error('Missing )')
    if (tokens[cursor] === ')') return [list, cursor + 1]
    const [value, next] = read(tokens, cursor)
    list.push(value)
    cursor = next
  }
}

const collectForms = (tokens, index = 0, forms = []) => {
  if (index >= tokens.length) return forms
  const [form, next] = read(tokens, index)
  return collectForms(tokens, next, [...forms, form])
}

/**
 * Parses source text into top-level Lisp forms.
 *
 * `parse` is intentionally literal: it tokenizes comments and parentheses,
 * turns numeric atoms into numbers, and returns the top-level forms exactly as
 * arrays, numbers, and symbols. A single term is therefore returned as a
 * one-form program, while definitions and a final expression are returned as
 * several forms. Semantic rewriting belongs to `encode`.
 *
 * Returns the thrown error after logging it, to preserve the current parser
 * contract used by the tests.
 *
 * @param {string} source
 * @returns {SourceForm[]}
 */
export const parse = source => collectForms(tokenize(source))
