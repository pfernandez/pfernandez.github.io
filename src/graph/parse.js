const err = (message, token) => {
  throw new Error(
    token ? `${message} at line ${token.line}, col ${token.col}` : message)
}

const locate = (source, index, text) => {
  const lines = source.slice(0, index).split('\n')
  return { text, line: lines.length, col: lines.at(-1).length + 1 }
}

// Comments are dropped; every token remembers its line and column.
const tokenize = source => {
  const pattern = /\s+|;[^\n]*|[()]|"(?:\\[\s\S]|[^"\\])*"|[^()\s";]+/y
  const tokens = []
  let index = 0

  while (index < source.length) {
    pattern.lastIndex = index
    const match = pattern.exec(source)
    if (!match)
      err(source[index] === '"' ? 'Missing "' : 'Unexpected token',
          locate(source, index))

    const text = match[0]
    const token = locate(source, index, text)
    index = pattern.lastIndex

    if (!/^\s/.test(text) && text[0] !== ';') tokens.push(token)
  }

  return tokens
}

export const parse = source => {
  const tokens = tokenize(source)
  let index = 0

  const readForm = () => {
    const token = tokens[index++]
    if (token.text === '(') return readList(token)
    if (token.text === ')') err('Unexpected )', token)
    if (token.text[0] === '"') {
      try {
        return Object.freeze({ value: JSON.parse(token.text) })
      } catch {
        err('Invalid string', token)
      }
    }
    return token.text
  }

  const readList = opener => {
    const items = []
    while (index < tokens.length && tokens[index].text !== ')')
      items.push(readForm())
    if (index >= tokens.length) err('Missing )', opener)
    index += 1
    return items
  }

  const forms = []
  while (index < tokens.length) forms.push(readForm())

  if (forms.length === 0) err('Missing expression')
  if (forms.length > 1) err('Expected one expression')

  return forms[0]
}
