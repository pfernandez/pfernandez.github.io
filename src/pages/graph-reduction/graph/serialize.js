export const log = x =>
  (typeof x === 'string'
    ? console.log(x)
    : console.dir(x, { maxArrayLength: null, depth: Infinity }),
  console.log('\n'),
  x)

export const schemes = Object.freeze({
  ink: 'ink',
  pastel: 'pastel',
  color: 'color',
  plain: 'plain'
})

export const schemeNames = Object.values(schemes)

const legendName = (node, legend) =>
  legend.find(entry => entry.node === node)?.symbol

const namedReference = (name, seen) =>
  name !== undefined && seen.size > 0

// Atoms print as their spelling; repeated cells print as the path where the
// cell first appeared, so sharing and cycles stay visible in plain text. A
// named root still opens; a named node inside another form prints as its name.
const printable = (node, path = '$', pathsByNode = new Map(), legend = []) => {
  if (!Array.isArray(node)) return String(node)

  const name = legendName(node, legend)
  if (namedReference(name, pathsByNode)) return String(name)
  if (pathsByNode.has(node))
    return name !== undefined ? String(name) : pathsByNode.get(node)
  if (name !== undefined && node[0] === node)
    return String(name)

  pathsByNode.set(node, path)
  const left = printable(node[0], `${path}.0`, pathsByNode, legend)
  const right = printable(node[1], `${path}.1`, pathsByNode, legend)
  return `(${left} ${right})`
}

const RESET = '\x1b[0m'
const COLOR_STEPS = [2, 3, 4, 5]
const COLOR_COUNT = COLOR_STEPS.length ** 3
const PASTEL_COLORS = [205, 198, 165, 135, 99]

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

const pastelGradient = (index, count) => {
  if (count < 2) return pastelColor(0)

  const position = index / (count - 1) * (PASTEL_COLORS.length - 1)
  const start = Math.floor(position)
  const end = Math.min(start + 1, PASTEL_COLORS.length - 1)
  const t = position - start
  return rgbColor(interpolate(pastelColor(start).rgb, pastelColor(end).rgb, t))
}

const colorScheme = color => ({
  ansi: (index, count) => color(index, count).ansi,
  style: (index, count) => ({ color: color(index, count).css })
})

const opacity = (index, count) =>
  count < 2 ? 1 : 0.2 + index / (count - 1) * 0.8

const identitySchemes = {
  [schemes.color]: colorScheme(identityColor),
  [schemes.ink]: {
    ansi: (index, count) =>
      `38;5;${232 + Math.round(opacity(index, count) * 23)}`,
    style: (index, count) => ({ opacity: opacity(index, count) })
  },
  [schemes.pastel]: colorScheme(pastelGradient),
  [schemes.plain]: {}
}

const scheme = name =>
  identitySchemes[name] || identitySchemes[schemes.color]

const identityFor = (node, identities) => {
  if (!identities.has(node))
    identities.set(node, identities.size)
  return identities.get(node)
}

// Parts keep graph identity separate from presentation. Repeated cells print
// as () with the same identity as their first occurrence.
const parts = (node, legend, seen, identities) => {
  if (!Array.isArray(node)) return [{ text: String(node) }]

  const name = legendName(node, legend)
  if (namedReference(name, seen)) return [{ text: String(name) }]
  if (seen.has(node))
    return name !== undefined
      ? [{ text: String(name) }]
      : [{ text: '()', identity: identityFor(node, identities) }]
  if (name !== undefined && node[0] === node)
    return [{ text: String(name) }]

  const identity = identityFor(node, identities)

  seen.add(node)
  return [
    { text: '(', identity },
    ...parts(node[0], legend, seen, identities),
    { text: ' ' },
    ...parts(node[1], legend, seen, identities),
    { text: ')', identity }
  ]
}

const serializeParts = (node, { legend = [] } = {}) =>
  parts(node, legend, new Set(), new Map())

const identityCount = parts =>
  parts.reduce(
    (count, part) =>
      part.identity === undefined ? count : Math.max(count, part.identity + 1),
    0)

const identityStyle = (
  identity,
  name = schemes.color,
  count = identity + 1
) => {
  const style = scheme(name).style
  return style ? style(identity, count) : {}
}

const partsToText = parts =>
  parts.map(part => part.text).join('')

const partsToAnsi = (parts, name = schemes.color) => {
  const ansi = scheme(name).ansi
  if (!ansi) return partsToText(parts)

  const count = identityCount(parts)
  return parts.map(part =>
    part.identity === undefined
      ? part.text
      : `\x1b[${ansi(part.identity, count)}m${part.text}${RESET}`
  ).join('')
}

const styleText = style =>
  ['font-weight: 700']
    .concat(Object.entries(style).map(([name, value]) => `${name}: ${value}`))
    .join('; ')

const partsToConsole = (parts, name = schemes.color) => {
  const selected = scheme(name)
  if (!selected.style) return [partsToText(parts)]

  const count = identityCount(parts)
  let text = ''
  const styles = []

  for (const part of parts) {
    if (part.identity === undefined) {
      text += part.text.replaceAll('%', '%%')
    } else {
      text += `%c${part.text.replaceAll('%', '%%')}%c`
      styles.push(styleText(identityStyle(part.identity, name, count)), '')
    }
  }

  return [text, ...styles]
}

const partsToVdom = (parts, name = schemes.color) => {
  const count = identityCount(parts)
  return ['pre', { class: 'output' }, ...parts.map(part =>
    part.identity === undefined
      ? part.text
      : ['span',
         { class: 'identity',
           style: identityStyle(part.identity, name, count) },
         part.text])]
}

const render = (parts, { format = 'text', scheme = schemes.color } = {}) => {
  if (format === 'ansi') return partsToAnsi(parts, scheme)
  if (format === 'console') return partsToConsole(parts, scheme)
  if (format === 'vdom') return partsToVdom(parts, scheme)
  return partsToText(parts)
}

// Text repeats print as paths so sharing and cycles stay visible without color.
// Presentation formats print repeated cells as () and keep identity separate.
export const serialize = (
  node,
  { legend = [], format = 'text', scheme = schemes.color } = {}
) =>
  format === 'text'
    ? printable(node, '$', new Map(), legend)
    : render(serializeParts(node, { legend }), { format, scheme })

export const imageLegend = ({ addresses }, entries = []) => {
  const legend = new Map()

  for (const { node, symbol } of entries)
    if (addresses.has(node))
      legend.set(addresses.get(node), String(symbol))

  return legend
}

// Same text presentation as serialize, reading cells from a DataView of u32
// addresses.
const wasmText = (
  view,
  root,
  legend,
  pathsByAddr = new Map()
) => {
  const printAddr = (addr, path) => {
    const name = legend.get(addr)
    if (namedReference(name, pathsByAddr)) return String(name)
    if (pathsByAddr.has(addr))
      return name !== undefined ? String(name) : pathsByAddr.get(addr)
    if (name !== undefined && view.getUint32(addr, true) === addr)
      return String(name)

    pathsByAddr.set(addr, path)
    const left = printAddr(view.getUint32(addr, true), `${path}.0`)
    const right = printAddr(view.getUint32(addr + 4, true), `${path}.1`)
    return `(${left} ${right})`
  }

  return printAddr(root, '$')
}

// Same identity-marked presentation as serialize, reading cells from a
// DataView.
const wasmParts = (view, root, legend) => {
  const seen = new Set()
  const identities = new Map()

  const printAddr = addr => {
    const name = legend.get(addr)
    if (namedReference(name, seen)) return [{ text: String(name) }]

    if (seen.has(addr))
      return name !== undefined
        ? [{ text: String(name) }]
        : [{ text: '()', identity: identityFor(addr, identities) }]
    if (name !== undefined && view.getUint32(addr, true) === addr)
      return [{ text: String(name) }]

    const identity = identityFor(addr, identities)
    seen.add(addr)
    const left = printAddr(view.getUint32(addr, true))
    const right = printAddr(view.getUint32(addr + 4, true))
    return [
      { text: '(', identity },
      ...left,
      { text: ' ' },
      ...right,
      { text: ')', identity }
    ]
  }

  return printAddr(root)
}

export const serializeWasm = (
  view,
  root,
  { legend = new Map(), format = 'text', scheme = schemes.color } = {}
) =>
  format === 'text'
    ? wasmText(view, root, legend)
    : render(wasmParts(view, root, legend), { format, scheme })
