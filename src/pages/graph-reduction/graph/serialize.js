import { leftAddress, rightAddress } from '../wasm/address.js'

export const log = (x, label) => {
  if (label) console.log(label)
  if (typeof x === 'string') console.log(x)
  else console.dir(x, { colors: true, depth: null })
  return x
}

export const schemes = Object.freeze(
  { ink: 'ink', pastel: 'pastel', color: 'color', plain: 'plain' })

export const schemeNames = Object.values(schemes)

const RESET = '\x1b[0m'
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
  return { ansi: `38;5;${color}`, css: `rgb(${rgb.join(', ')})`, rgb }
}

const rgbColor = rgb =>
  ({ ansi: `38;2;${rgb.join(';')}`, css: `rgb(${rgb.join(', ')})`, rgb })

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
  ({ ansi: identity => color(identity).ansi,
     style: identity => ({ color: color(identity).css }) })

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

const wasmIdentity = (address, identities) => {
  if (!identities.has(address)) identities.set(address, identities.size)
  return identities.get(address)
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

const wasmTokens = (
  view,
  root,
  legend,
  { repeat = 'identity', path = '$', seen = new Map(),
    identities = new Map() } = {}
) => {
  const symbol = legend.get(root)
  const identity = wasmIdentity(root, identities)
  if (seen.has(root))
    return [symbol === undefined
      ? repeat === 'path'
        ? textToken(seen.get(root))
        : identityToken('()', identity)
      : identityToken(String(symbol), identity)]

  const left = leftAddress(view, root)
  const right = rightAddress(view, root)
  if (symbol !== undefined && left === root && right === root)
    return [identityToken(String(symbol), identity)]

  seen.set(root, path)
  const next = { repeat, seen, identities }
  return [
    identityToken('(', identity),
    ...wasmTokens(view, left, legend, {
      ...next,
      path: `${path}.0`
    }),
    textToken(' '),
    ...wasmTokens(view, right, legend, {
      ...next,
      path: `${path}.1`
    }),
    identityToken(')', identity)
  ]
}

const tokensToText = tokens =>
  tokens.map(token => token.text).join('')

const tokensToAnsi = (tokens, schemeName) => {
  const ansi = selectedScheme(schemeName).ansi
  if (!ansi) return tokensToText(tokens)

  return tokens.map(token =>
    token.identity === undefined
      ? token.text
      : `\x1b[${ansi(token.identity)}m${token.text}${RESET}`)
    .join('')
}

const styleText = style =>
  ['font-weight: 700']
    .concat(Object.entries(style).map(([name, value]) => `${name}: ${value}`))
    .join('; ')

const tokensToConsole = (tokens, schemeName) => {
  const style = selectedScheme(schemeName).style
  if (!style) return [tokensToText(tokens)]

  let text = ''
  const styles = []

  for (const token of tokens) {
    if (token.identity === undefined) {
      text += token.text.replaceAll('%', '%%')
    } else {
      text += `%c${token.text.replaceAll('%', '%%')}%c`
      styles.push(styleText(style(token.identity)), '')
    }
  }

  return [text, ...styles]
}

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
  if (format === 'ansi') return tokensToAnsi(tokens, scheme)
  if (format === 'console') return tokensToConsole(tokens, scheme)
  if (format === 'vdom') return tokensToVdom(tokens, scheme)
  return tokensToText(tokens)
}

const writeTrace = (output, options) => {
  const { label } = options
  const count = options.count === true ? 0 : options.count
  const prefix =
    [count === false || count === undefined ? undefined : count,
     label].filter(part => part !== undefined).join(' ')
  const separator = prefix && !prefix.endsWith('\n') ? ' ' : ''

  if (count !== false && count !== undefined) options.count = count + 1

  return log(`${prefix}${separator}${output}\n`)
}

export const serialize = (
  graph,
  { format = 'text', scheme = schemes.color, width = DEFAULT_WIDTH } = {}
) => renderTokens(graphTokens(graph, {
  width,
  repeat: format === 'text' ? 'path' : 'identity'
}), { format, scheme })

export const trace = (graph, options = {}) => {
  const { format = 'ansi', scheme = schemes.color,
          width = DEFAULT_WIDTH } = options
  const output = serialize(graph, { format, scheme, width })

  return writeTrace(output, options)
}

export const addressLegend = ({ addresses }) => {
  const byAddress = new Map()

  for (const [node, address] of addresses)
    if (node.symbol !== undefined) byAddress.set(address, node.symbol)

  return byAddress
}

export const serializeWasm = (
  view,
  root,
  { legend = new Map(), format = 'text', scheme = schemes.color } = {}
) => renderTokens(wasmTokens(view, root, legend, {
  repeat: format === 'text' ? 'path' : 'identity'
}), { format, scheme })

export const traceWasm = (view, root, options = {}) => {
  const { legend, format = 'ansi', scheme = schemes.color } = options
  const output = serializeWasm(
    view, root, { legend: legend ?? new Map(), format, scheme })
  return writeTrace(output, options)
}
