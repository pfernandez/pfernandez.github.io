// Every node is a cell: a two-element array. cell[0] is the function side
// and cell[1] is the argument side, so the application (f x) is the cell
// [f, x]. There are no tags; every role is recognized by shape:
//   atom        both sides point at the cell itself
//   slot        a parameter: itself on the left, its definition on the right
//   answer      itself on the left, a result on the right
//   definition  its right side is a slot pointing back at it

// 1. read — parentheses become nested arrays

// Comments are dropped; every token remembers its line and column.
const tokenize = source =>
  [...source.matchAll(/(;.*$)|"([^"\\]|\\.)*"|[()]|[^()\s]+/gm)]
    .filter(match => !match[1])
    .map(match => {
      const lines = source.slice(0, match.index).split('\n')
      return { text: match[0],
               value: match[0].startsWith('"')
                 ? match[0].slice(1, -1).replace(/\\"/g, '"')
                 : isNaN(match[0]) ? match[0] : Number(match[0]),
               line: lines.length,
               col: lines.at(-1).length + 1 }
    })

const err = (message, token) => {
  throw new Error(
    token ? `${message} at line ${token.line}, col ${token.col}` : message)
}

const read = tokens => {
  let index = 0

  const readForm = () => {
    const token = tokens[index++]
    if (token.text === '(') return readList(token)
    if (token.text === ')') err('Unexpected )', token)
    return token.value
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
  return forms
}

// 2. define — a definition (Name form) writes a complete call:
//    the body applied to each parameter in turn, so (K ((x x) y)) reads
//    "K applied to x and then y leaves x"

const isSymbol = form =>
  typeof form === 'string'

// A scope is a list of [name, cell] pairs; first match wins.
const binding = (name, bindings) =>
  bindings.find(([bindingName]) => bindingName === name)

const lookup = (name, scopes) => {
  for (const scope of scopes) {
    const found = binding(name, scope)
    if (found) return found[1]
  }
}

// One cell per spelling, so atoms compare by identity; spellings is the
// reverse map, used for printing.
const atoms = new Map()
const spellings = new Map()

const intern = spelling => {
  if (!atoms.has(spelling)) {
    const cell = []
    cell[0] = cell
    cell[1] = cell
    atoms.set(spelling, cell)
    spellings.set(cell, spelling)
  }
  return atoms.get(spelling)
}

// Left-nested application: applyArgs(f, [a, b]) is ((f a) b).
const applyArgs = (head, args) =>
  args.reduce((node, arg) => [node, arg], head)

// A symbol means its binding if it has one, otherwise an atom; a list is
// its head applied to each item in turn.
const buildGraph = (form, scopes) =>
  !Array.isArray(form)
    ? isSymbol(form) && lookup(form, scopes) || intern(form)
    : form.length
      ? applyArgs(buildGraph(form[0], scopes),
                  form.slice(1).map(item => buildGraph(item, scopes)))
      : intern('()')

// A top-level (name form) where name is unbound introduces a definition.
const isDefinitionForm = (form, scope) =>
  Array.isArray(form) && form.length === 2
    && isSymbol(form[0]) && !binding(form[0], scope.names)

// Walk the form's left edge collecting parameter names, innermost first —
// the order arguments are supplied; null if there are none.
const parameters = (form, scope, names = []) =>
  Array.isArray(form) && form.length === 2 && isSymbol(form[1])
      && !binding(form[1], scope.names) && !names.includes(form[1])
    ? parameters(form[0], scope, [form[1], ...names])
    : names.length ? names : null

// The definition is built from the form; each parameter becomes a slot pointing
// back at it. The name binds before the form builds, so self-reference is a
// cycle, not an expansion.
const define = ([name, form], scope) => {
  const parameterNames = parameters(form, scope)
  if (!parameterNames) err('Definitions need a body and at least one slot')

  const definition = []
  const parameterBindings = parameterNames.map(name => {
    const slot = []
    slot[0] = slot
    slot[1] = definition
    return [name, slot]
  })

  scope.names.push([name, definition])
  definition.push(...buildGraph(form, [parameterBindings, scope.names]))
}

// 3. reduce — follow a call's function sides to its head; a definition with
//    enough arguments becomes its answer: the body with each slot replaced by
//    its argument.
// 4. tie recursion — when a matching call is already active, point at that
//    call's answer. Calls that never repeat eventually exhaust patience.

// Observation stops where the function side is the cell itself: atoms,
// slots, and answers are all stable.
const isStable = node =>
  Array.isArray(node) && node[0] === node

// The outermost cell built by define: its argument side is a slot pointing
// back at it.
const isDefinition = node =>
  Array.isArray(node) && !isStable(node)
    && isStable(node[1]) && node[1][1] === node

// Complete cells need no reduction: stable cells are finished, definitions wait.
const isComplete = node =>
  isStable(node) || isDefinition(node)

// Read a left-nested application as a call: ((K a) b) is head K, args [a, b].
const call = (node, args = []) =>
  isComplete(node) ? { head: node, args }
    : call(node[0], [node[1], ...args])

// Strip parameter applications to reach the body; slots return in the order
// arguments are supplied. A repeated slot belongs to the body, as in M.
const definitionBody = (definition, node = definition, slots = []) =>
  isStable(node[1]) && node[1][1] === definition && !slots.includes(node[1])
    ? definitionBody(definition, node[0], [node[1], ...slots])
    : [node, slots]

// Copy with each slot replaced by its argument; complete cells stay shared, and
// copies keep sharing and cycles intact in the copy.
const substitute = (node, substitutions, copies = new Map()) => {
  const match = substitutions.find(([from]) => node === from)
  if (match) return match[1]
  if (isComplete(node)) return node
  if (copies.has(node)) return copies.get(node)

  const copy = []
  copies.set(node, copy)
  node.forEach(item => copy.push(substitute(item, substitutions, copies)))
  return copy
}

// An in-progress call of the same definition with identical arguments;
// each active call is [definition, args, focus].
const isSameCall = (head, args, [definition, priorArgs]) =>
  definition === head
      && priorArgs.length === args.length
      && priorArgs.every((arg, i) => arg === args[i])

const findActiveCall = (head, args, activeCalls) =>
  activeCalls.find(activeCall => isSameCall(head, args, activeCall))

// Calls that never repeat would reduce forever; compile sets the budget.
let patience = 0

// A completed call returns its focus: the call's shape with the answer at
// its head, so observation runs to the answer and select reads the result.
// Arguments beyond the slots stay applied to the body.
const reduceGraph = (node, activeCalls = []) => {
  if (isComplete(node)) return node
  if (--patience < 0) err('Reduction never settles')

  const { head, args } = call(node)
  const bodyAndSlots = isDefinition(head) && definitionBody(head)

  if (!bodyAndSlots || args.length < bodyAndSlots[1].length)
    return node.map(item => reduceGraph(item, activeCalls))

  const [body, slots] = bodyAndSlots
  const reducedArgs = args.map(arg => reduceGraph(arg, activeCalls))
  const activeCall = findActiveCall(head, reducedArgs, activeCalls)
  if (activeCall) return activeCall[2]

  const answer = []
  const focus = applyArgs(answer, reducedArgs)
  const substitutions = slots.map((slot, i) => [slot, reducedArgs[i]])
  const bodyWithArgs = substitute(
    applyArgs(body, reducedArgs.slice(slots.length)),
    substitutions)

  answer[0] = answer
  answer[1] = reduceGraph(
    bodyWithArgs,
    [[head, reducedArgs, focus], ...activeCalls])

  return focus
}

// Definitions extend the scope; the last remaining form is the focus.
export const compile = source => {
  const scope = { names: [] }
  let focus

  patience = 1e6

  for (const form of read(tokenize(source)))
    focus = isDefinitionForm(form, scope)
      ? void define(form, scope)
      : reduceGraph(buildGraph(form, [scope.names]))

  if (focus === undefined) err('Missing focus')
  return focus
}

// 5. observe — follow function sides until a cell points at itself; select
//    reads its argument side; an atom is its own answer and its own payload

// Atoms print as their spelling; repeated cells print as the path where the
// cell first appeared, so sharing and cycles stay visible in plain text.
const printable = (node, path = '$', pathsByNode = new Map()) => {
  if (!Array.isArray(node)) return String(node)
  if (spellings.has(node)) return String(spellings.get(node))
  if (pathsByNode.has(node)) return pathsByNode.get(node)

  pathsByNode.set(node, path)
  const left = printable(node[0], `${path}.0`, pathsByNode)
  const right = printable(node[1], `${path}.1`, pathsByNode)
  return `(${left} ${right})`
}

export const serialize = form =>
  printable(form)

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
export const serializeParts = (
  node,
  seen = new Set(),
  identities = new Map()
) => {
  if (!Array.isArray(node)) return [{ text: String(node) }]
  if (spellings.has(node)) return [{ text: String(spellings.get(node)) }]

  const identity = identityFor(node, identities)
  if (seen.has(node)) return [{ text: '()', identity }]

  seen.add(node)
  return [
    { text: '(', identity },
    ...serializeParts(node[0], seen, identities),
    { text: ' ' },
    ...serializeParts(node[1], seen, identities),
    { text: ')', identity }
  ]
}

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

export const serializeAnsi = (node, name = 'color') =>
  partsToAnsi(serializeParts(node), name)

export const serializeConsole = (node, name = 'color') =>
  partsToConsole(serializeParts(node), name)

export const serializeColor = serializeAnsi

export const observe = (pair, trace) => (
  trace?.(pair),
  pair[0] === pair ? pair
    : observe(pair[0], trace))

export const select = found =>
  found[1]

let traceCount = 0
const traceScheme = () =>
  typeof process === 'undefined'
    ? 'color'
    : process.env.GRAPH_SCHEME || 'color'

const trace = form =>
  console.log(traceCount++, serializeAnsi(form, traceScheme()), '\n')

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const file = process.argv[2] ?? new URL('./core.lisp', import.meta.url)

  const found = observe(compile(readFileSync(file, 'utf-8')), trace)
  trace(select(found))
}
