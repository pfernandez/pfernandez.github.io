import { spellings } from './compile.js'

const legendName = (node, legend = []) =>
  legend.find?.(entry => entry.node === node)?.symbol

const graphName = (node, legend) =>
  legendName(node, legend) ?? spellings.get(node)

// Atoms print as their spelling; repeated cells print as the path where the
// cell first appeared, so sharing and cycles stay visible in plain text.
const printable = (node, path = '$', pathsByNode = new Map(), legend = []) => {
  if (!Array.isArray(node)) return String(node)

  const name = graphName(node, legend)
  if (pathsByNode.has(node))
    return name !== undefined ? String(name) : pathsByNode.get(node)
  if (name !== undefined && node[0] === node && node[1] === node)
    return String(name)

  pathsByNode.set(node, path)
  const left = printable(node[0], `${path}.0`, pathsByNode, legend)
  const right = printable(node[1], `${path}.1`, pathsByNode, legend)
  return `(${left} ${right})`
}

export const serialize = (form, { legend = [] } = {}) =>
  printable(form, '$', new Map(), legend)

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

export const identitySchemes = {
  color: colorScheme(identityColor),
  ink: {
    ansi: (index, count) =>
      `38;5;${232 + Math.round(opacity(index, count) * 23)}`,
    style: (index, count) => ({ opacity: opacity(index, count) })
  },
  pastel: colorScheme(pastelGradient),
  plain: {}
}

const scheme = name =>
  identitySchemes[name] || identitySchemes.color

const identityFor = (node, identities) => {
  if (!identities.has(node))
    identities.set(node, identities.size)
  return identities.get(node)
}

// Parts keep graph identity separate from presentation. Repeated cells print
// as () with the same identity as their first occurrence.
const parts = (node, legend, seen, identities) => {
  if (!Array.isArray(node)) return [{ text: String(node) }]

  const name = graphName(node, legend)
  if (seen.has(node))
    return name !== undefined
      ? [{ text: String(name) }]
      : [{ text: '()', identity: identityFor(node, identities) }]
  if (name !== undefined && node[0] === node && node[1] === node)
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

// Parts keep graph identity separate from presentation. Repeated cells print
// as () with the same identity as their first occurrence.
export const serializeParts = (node, { legend = [] } = {}) =>
  parts(node, legend, new Set(), new Map())

export const identityCount = parts =>
  parts.reduce(
    (count, part) =>
      part.identity === undefined ? count : Math.max(count, part.identity + 1),
    0)

export const identityStyle = (identity, name = 'color', count = identity + 1) => {
  const style = scheme(name).style
  return style ? style(identity, count) : {}
}

export const partsToText = parts =>
  parts.map(part => part.text).join('')

export const partsToAnsi = (parts, name = 'color') => {
  const ansi = scheme(name).ansi
  if (!ansi) return partsToText(parts)

  const count = identityCount(parts)
  return parts.map(part =>
    part.identity === undefined
      ? part.text
      : `\x1b[${ansi(part.identity, count)}m${part.text}${RESET}`)
    .join('')
}

const styleText = style =>
  ['font-weight: 700']
    .concat(Object.entries(style).map(([name, value]) => `${name}: ${value}`))
    .join('; ')

export const partsToConsole = (parts, name = 'color') => {
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

export const serializeAnsi = (node, options = 'color') =>
  typeof options === 'string'
    ? partsToAnsi(serializeParts(node), options)
    : partsToAnsi(serializeParts(node, options), options.scheme)

export const serializeConsole = (node, options = 'color') =>
  typeof options === 'string'
    ? partsToConsole(serializeParts(node), options)
    : partsToConsole(serializeParts(node, options), options.scheme)

export const serializeColor = serializeAnsi

export const imageLegend = ({ addresses }) => {
  const legend = new Map()

  for (const [node, addr] of addresses)
    if (Array.isArray(node) && node[0] === node && node[1] === node)
      legend.set(addr, serialize(node))

  return legend
}

// Same presentation as serialize, reading cells from a DataView of u32 addresses.
export const serializeImage = (
  view,
  root,
  legend,
  pathsByAddr = new Map()
) => {
  const printAddr = (addr, path) => {
    if (legend.has(addr)) return String(legend.get(addr))
    if (pathsByAddr.has(addr)) return pathsByAddr.get(addr)

    pathsByAddr.set(addr, path)
    const left = printAddr(view.getUint32(addr, true), `${path}.0`)
    const right = printAddr(view.getUint32(addr + 4, true), `${path}.1`)
    return `(${left} ${right})`
  }

  return printAddr(root, '$')
}

// Same presentation as serializeParts, reading cells from a DataView.
export const serializeImageParts = (view, root, legend) => {
  const seen = new Set()
  const identities = new Map()

  const printAddr = addr => {
    if (legend.has(addr)) return [{ text: String(legend.get(addr)) }]

    const identity = identityFor(addr, identities)
    if (seen.has(addr)) return [{ text: '()', identity }]

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

export const serializeImageAnsi = (view, root, legend, scheme = 'color') =>
  partsToAnsi(serializeImageParts(view, root, legend), scheme)

export const serializeImageColor = serializeImageAnsi
