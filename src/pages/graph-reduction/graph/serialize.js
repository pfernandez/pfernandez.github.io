export const schemes = Object.freeze({
  ink: 'ink',
  pastel: 'pastel',
  color: 'color',
  plain: 'plain'
})

export const schemeNames = Object.values(schemes)

const RESET = '\x1b[0m'
const COLOR_STEPS = [2, 3, 4, 5]
const COLOR_COUNT = COLOR_STEPS.length ** 3
const PASTEL_COLORS = [205, 198, 165, 135, 99]

const nameOf = (legend, node) => {
  const entry = legend.find(([identity]) => identity === node)
  return entry && entry[1]
}

const xtermChannel = step =>
  step === 0 ? 0 : 55 + step * 40

const xtermColor = color => {
  const offset = color - 16
  const red = Math.floor(offset / 36)
  const green = Math.floor(offset / 6) % 6
  const blue = offset % 6
  const rgb = [red, green, blue].map(xtermChannel)
  return { ansi: `38;5;${color}`, css: `rgb(${rgb.join(', ')})`, rgb }
}

const rgbColor = rgb => ({
  ansi: `38;2;${rgb.join(';')}`,
  css: `rgb(${rgb.join(', ')})`,
  rgb
})

const interpolate = (start, end, t) =>
  start.map((channel, i) => Math.round(channel + (end[i] - channel) * t))

const identityColor = index => {
  const offset = index * 29 % COLOR_COUNT
  const red = COLOR_STEPS[offset % COLOR_STEPS.length]
  const green =
    COLOR_STEPS[Math.floor(offset / COLOR_STEPS.length) % COLOR_STEPS.length]
  const blue =
    COLOR_STEPS[Math.floor(offset / COLOR_STEPS.length ** 2)]
  return xtermColor(16 + 36 * red + 6 * green + blue)
}

const pastelColor = index =>
  xtermColor(PASTEL_COLORS[Math.min(index, PASTEL_COLORS.length - 1)])

const spread = index =>
  index * 29 % COLOR_COUNT / (COLOR_COUNT - 1)

const pastelGradient = index => {
  const position = spread(index) * (PASTEL_COLORS.length - 1)
  const start = Math.floor(position)
  const end = Math.min(start + 1, PASTEL_COLORS.length - 1)
  const t = position - start
  return rgbColor(interpolate(pastelColor(start).rgb, pastelColor(end).rgb, t))
}

const colorScheme = color => ({
  ansi: identity => color(identity).ansi,
  style: identity => ({ color: color(identity).css })
})

const opacity = index =>
  0.2 + spread(index) * 0.8

const schemeRenderers = {
  [schemes.color]: colorScheme(identityColor),
  [schemes.ink]: {
    ansi: index =>
      `38;5;${232 + Math.round(opacity(index) * 23)}`,
    style: index => ({ opacity: opacity(index) })
  },
  [schemes.pastel]: colorScheme(pastelGradient),
  [schemes.plain]: {}
}

const selectedScheme = name =>
  schemeRenderers[name] || schemeRenderers[schemes.color]

const jsIdentities = new WeakMap()
let nextJsIdentity = 0

const jsIdentity = node => {
  if (!jsIdentities.has(node))
    jsIdentities.set(node, nextJsIdentity++)
  return jsIdentities.get(node)
}

const wasmIdentity = (address, identities) => {
  if (!identities.has(address))
    identities.set(address, identities.size)
  return identities.get(address)
}

const textToken = text => ({ text })

const identityToken = (text, identity) =>
  ({ text, identity })

const graphText = (node, legend, path = '$', seen = new Map()) => {
  if (!Array.isArray(node)) return String(node)

  const name = nameOf(legend, node)
  if (name !== undefined) return String(name)
  if (seen.has(node)) return seen.get(node)

  seen.set(node, path)
  const left = graphText(node[0], legend, `${path}.0`, seen)
  const right = graphText(node[1], legend, `${path}.1`, seen)
  return `(${left} ${right})`
}

const graphTokens = (
  node,
  legend,
  seen = new Set()
) => {
  if (!Array.isArray(node)) return [textToken(String(node))]

  const name = nameOf(legend, node)
  if (name !== undefined) return [textToken(String(name))]

  const identity = jsIdentity(node)
  if (seen.has(node)) return [identityToken('()', identity)]

  seen.add(node)
  return [
    identityToken('(', identity),
    ...graphTokens(node[0], legend, seen),
    textToken(' '),
    ...graphTokens(node[1], legend, seen),
    identityToken(')', identity)
  ]
}

const wasmText = (view, root, legend, path = '$', seen = new Map()) => {
  if (legend.has(root)) return String(legend.get(root))
  if (seen.has(root)) return seen.get(root)

  seen.set(root, path)
  const left =
    wasmText(view, view.getUint32(root, true), legend, `${path}.0`, seen)
  const right =
    wasmText(view, view.getUint32(root + 4, true), legend, `${path}.1`, seen)
  return `(${left} ${right})`
}

const wasmTokens = (
  view,
  root,
  legend,
  seen = new Set(),
  identities = new Map()
) => {
  if (legend.has(root)) return [textToken(String(legend.get(root)))]

  const identity = wasmIdentity(root, identities)
  if (seen.has(root)) return [identityToken('()', identity)]

  seen.add(root)
  return [
    identityToken('(', identity),
    ...wasmTokens(view, view.getUint32(root, true), legend, seen, identities),
    textToken(' '),
    ...wasmTokens(
      view,
      view.getUint32(root + 4, true),
      legend,
      seen,
      identities),
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
  const prefix = [
    count === false || count === undefined ? undefined : count,
    label
  ].filter(part => part !== undefined).join(' ')

  if (count !== false && count !== undefined)
    options.count = count + 1

  console.log(`${prefix ? `${prefix} ` : ''}${output}\n`)
}

export const serialize = (
  graph,
  { legend = [], format = 'text', scheme = schemes.color } = {}
) =>
  format === 'text'
    ? graphText(graph, legend)
    : renderTokens(graphTokens(graph, legend), { format, scheme })

export const trace = (graph, options = {}) => {
  const {
    legend,
    format = 'ansi',
    scheme = schemes.color
  } = options
  const output = serialize(graph, { legend: legend ?? [], format, scheme })
  writeTrace(output, options)
}

export const addressLegend = ({ addresses }, legend = []) => {
  const byAddress = new Map()

  for (const [node, name] of legend)
    if (addresses.has(node))
      byAddress.set(addresses.get(node), name)

  return byAddress
}

export const serializeWasm = (
  view,
  root,
  { legend = new Map(), format = 'text', scheme = schemes.color } = {}
) =>
  format === 'text'
    ? wasmText(view, root, legend)
    : renderTokens(wasmTokens(view, root, legend), { format, scheme })

export const traceWasm = (view, root, options = {}) => {
  const {
    legend,
    format = 'ansi',
    scheme = schemes.color
  } = options
  const output = serializeWasm(view, root, {
    legend: legend ?? new Map(),
    format,
    scheme
  })

  writeTrace(output, options)
}
