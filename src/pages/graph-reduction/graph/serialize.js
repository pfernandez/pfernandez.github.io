export const schemes = Object.freeze(
  { ink: 'ink', pastel: 'pastel', color: 'color', plain: 'plain' })

export const schemeNames = Object.values(schemes)

const COLOR_STEPS = [2, 3, 4, 5]
const COLOR_COUNT = COLOR_STEPS.length ** 3
const PASTEL_COLORS = [205, 198, 165, 135, 99]
const DEFAULT_WIDTH = 40

const xtermChannel = step => step === 0 ? 0 : 55 + step * 40

const xtermColor = color => {
  const offset = color - 16
  const red = Math.floor(offset / 36)
  const green = Math.floor(offset / 6) % 6
  const blue = offset % 6
  const rgb = [red, green, blue].map(xtermChannel)
  return { css: `rgb(${rgb.join(', ')})`, rgb }
}

const rgbColor = rgb =>
  ({ css: `rgb(${rgb.join(', ')})`, rgb })

const interpolate = (start, end, t) =>
  start.map((channel, i) => Math.round(channel + (end[i] - channel) * t))

const identityColor = index => {
  const offset = index * 29 % COLOR_COUNT
  const red = COLOR_STEPS[offset % COLOR_STEPS.length]
  const green =
    COLOR_STEPS[Math.floor(offset / COLOR_STEPS.length) % COLOR_STEPS.length]
  const blue = COLOR_STEPS[Math.floor(offset / COLOR_STEPS.length ** 2)]
  return xtermColor(16 + 36 * red + 6 * green + blue)
}

const pastelColor = index =>
  xtermColor(PASTEL_COLORS[Math.min(index, PASTEL_COLORS.length - 1)])

const spread = index => index * 29 % COLOR_COUNT / (COLOR_COUNT - 1)

const pastelGradient = index => {
  const position = spread(index) * (PASTEL_COLORS.length - 1)
  const start = Math.floor(position)
  const end = Math.min(start + 1, PASTEL_COLORS.length - 1)
  const t = position - start
  return rgbColor(interpolate(pastelColor(start).rgb, pastelColor(end).rgb, t))
}

const colorScheme = color =>
  ({ style: identity => ({ color: color(identity).css }) })

const opacity = index => 0.2 + spread(index) * 0.8

const schemeRenderers =
  { [schemes.color]: colorScheme(identityColor),
    [schemes.ink]:
    { ansi: index => `38;5;${232 + Math.round(opacity(index) * 23)}`,
      style: index => ({ opacity: opacity(index) }) },
    [schemes.pastel]: colorScheme(pastelGradient),
    [schemes.plain]: {} }

const selectedScheme = name =>
  schemeRenderers[name] || schemeRenderers[schemes.color]

const jsIdentities = new WeakMap()
let nextJsIdentity = 0

const jsIdentity = node => {
  if (!jsIdentities.has(node)) jsIdentities.set(node, nextJsIdentity++)
  return jsIdentities.get(node)
}

const textToken = text => ({ text })

const identityToken = (text, identity) => ({ text, identity })

const tokenDocument = token => ({ token, width: token.text.length })

const graphDocument = (
  node,
  repeat = 'identity',
  path = '$',
  seen = new Map()
) => {
  if (!Array.isArray(node)) return tokenDocument(textToken(String(node)))

  if (seen.has(node))
    return tokenDocument(node.symbol === undefined
      ? repeat === 'path'
        ? textToken(seen.get(node))
        : identityToken('()', jsIdentity(node))
      : identityToken(String(node.symbol), jsIdentity(node)))

  if (node.symbol !== undefined && node[0] === node && node[1] === node)
    return tokenDocument(identityToken(String(node.symbol), jsIdentity(node)))

  seen.set(node, path)
  const children = node.map((child, index) =>
    graphDocument(child, repeat, `${path}.${index}`, seen))

  return {
    children,
    identity: repeat === 'path' ? undefined : jsIdentity(node),
    width: 2 + Math.max(0, children.length - 1)
      + children.reduce((width, child) => width + child.width, 0)
  }
}

const documentToken = (document, text) =>
  document.identity === undefined
    ? textToken(text)
    : identityToken(text, document.identity)

const flatTokens = document => {
  if (document.token) return [document.token]

  const tokens = [documentToken(document, '(')]
  document.children.forEach((child, index) => {
    if (index) tokens.push(textToken(' '))
    tokens.push(...flatTokens(child))
  })
  tokens.push(documentToken(document, ')'))
  return tokens
}

const layoutTokens = (document, width, column = 0) => {
  if (document.token || column + document.width <= width)
    return { tokens: flatTokens(document), column: column + document.width }

  const indent = column + 1
  const tokens = [documentToken(document, '(')]
  let end = indent

  document.children.forEach((child, index) => {
    if (index) {
      tokens.push(textToken(`\n${' '.repeat(indent)}`))
      end = indent
    }

    const layout = layoutTokens(child, width, end)
    tokens.push(...layout.tokens)
    end = layout.column
  })

  tokens.push(documentToken(document, ')'))
  return { tokens, column: end + 1 }
}

const graphTokens = (node, { width, repeat } = {}) =>
  layoutTokens(graphDocument(node, repeat), width).tokens

const tokensToText = tokens =>
  tokens.map(token => token.text).join('')

const tokensToVdom = (tokens, schemeName) => {
  const style = selectedScheme(schemeName).style ?? (() => ({}))
  return ['pre', { class: 'output' }, ...tokens.map(token =>
    token.identity === undefined
      ? token.text
      : ['span',
         { class: 'identity',
           style: style(token.identity) },
         token.text])]
}

const renderTokens = (tokens, { format, scheme }) => {
  if (format === 'vdom') return tokensToVdom(tokens, scheme)
  return tokensToText(tokens)
}

export const serialize = (
  graph,
  { format = 'text', scheme = schemes.color, width = DEFAULT_WIDTH } = {}
) => renderTokens(graphTokens(graph, {
  width,
  repeat: format === 'text' ? 'path' : 'identity'
}), { format, scheme })
