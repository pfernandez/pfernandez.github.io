// Comments are dropped; every token remembers its line and column.
const tokenize = source =>
  [...source.matchAll(/(;.*$)|[()]|[^()\s]+/gm)]
    .filter(match => !match[1])
    .map(match => {
      const lines = source.slice(0, match.index).split('\n')
      return { text: match[0],
               line: lines.length,
               col: lines.at(-1).length + 1 }
    })

export const err = (message, token) => {
  throw new Error(
    token ? `${message} at line ${token.line}, col ${token.col}` : message)
}

export const parse = source => {
  const tokens = tokenize(source)
  let index = 0

  const readForm = (program = false, allowEmpty = false) => {
    const token = tokens[index++]
    if (token.text === '(') return readList(token, program, allowEmpty)
    if (token.text === ')') err('Unexpected )', token)
    return token.text
  }

  const readList = (opener, program, allowEmpty) => {
    const items = []
    while (index < tokens.length && tokens[index].text !== ')')
      items.push(readForm(false, program && !items.length))
    if (index >= tokens.length) err('Missing )', opener)
    index += 1
    if (!items.length && !allowEmpty)
      err('Unexpected ()', opener)
    return items
  }

  const forms = []
  while (index < tokens.length) forms.push(readForm(!forms.length))
  if (forms.length === 0) err('Missing expression')
  if (forms.length > 1) err('Expected one expression')
  return forms[0]
}
