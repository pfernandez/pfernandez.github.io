const tokenize = src =>
  [...src.matchAll(/(;.*$)|"([^"\\]|\\.)*"|[()]|[^()\s]+/gm)]
    .filter(m => !m[1])
    .map(m =>
      (lines =>
        ({ text: m[0],
           value: m[0].startsWith('"')
             ? m[0].slice(1, -1).replace(/\\"/g, '"')
             : isNaN(Number(m[0])) || m[0].trim() === '' ? m[0] : Number(m[0]),
           line: lines.length,
           col: lines.at(-1).length + 1 }))(src.slice(0, m.index).split('\n')))

const err = (msg, tok) =>
{ throw new Error(tok ? `${msg} at line ${tok.line}, col ${tok.col}` : msg) }

const read = tokens => {
  let index = 0

  const form = () => {
    const token = tokens[index++]
    if (!token) err('Missing expression')
    if (token.text === '(') return list(token)
    if (token.text === ')') err('Unexpected )', token)
    return token.value
  }

  const list = opener => {
    const items = []
    while (index < tokens.length && tokens[index].text !== ')')
      items.push(form())
    if (index >= tokens.length) err('Missing )', opener)
    index += 1
    return items
  }

  const forms = []
  while (index < tokens.length) forms.push(form())
  if (forms.length === 0) err('Missing expression')
  return forms
}

const binding = (name, bindings) =>
  bindings.find(([mark]) => mark === name)

const bound = (value, bindings) =>
  bindings.some(([, node]) => node === value)

const lookup = (name, scopes) => {
  for (const scope of scopes) {
    const match = binding(name, scope)
    if (match) return match[1]
  }
}

const sourceDefinition = (form, scope) =>
  Array.isArray(form) && form.length === 2
    && typeof form[0] === 'string' && !binding(form[0], scope.names)

const stable = form =>
  Array.isArray(form) && form[0] === form

const atom = (form, scope) =>
  !Array.isArray(form) || stable(form) || bound(form, scope.names)

const symbol = form =>
  typeof form === 'string'

const unique = forms =>
  forms.every((form, i) => !forms.slice(0, i).includes(form))

const call = (head, args, calls) =>
  calls.find(([fn, seen]) =>
    fn === head
      && seen.length === args.length
      && seen.every((arg, i) => arg === args[i]))

const flat = (first, rest) => rest.length ? [first, ...rest] : first

const spine = (first, rest) => rest.reduce((form, next) => [form, next], first)

const outputs = { flat, spine }

const root = (form, scope, args = []) =>
  atom(form, scope) ? { head: form, args }
    : root(form[0], scope, [...form.slice(1), ...args])

const build = (form, scopes) =>
  Array.isArray(form) ? form.map(item => build(item, scopes))
    : typeof form === 'string' ? lookup(form, scopes) ?? form
      : form

const replace = (form, pairs, scope, seen = new Map()) => {
  const match = pairs.find(([from]) => form === from)
  if (match) return match[1]
  if (atom(form, scope)) return form
  if (seen.has(form)) return seen.get(form)

  const copy = []
  seen.set(form, copy)
  form.forEach(item => copy.push(replace(item, pairs, scope, seen)))
  return copy
}

const tie = (form, scope, bind, calls = []) => {
  if (atom(form, scope)) return form

  const { head, args } = root(form, scope)

  if (!bound(head, scope.names) || args.length < head.length - 1)
    return form.map(item => tie(item, scope, bind, calls))

  const tied = args.map(arg => tie(arg, scope, bind, calls))
  const active = call(head, tied, calls)
  if (active) return active[2]

  const self = []
  const focus = bind(self, tied)
  const slots = head.slice(1)
  const pairs = slots.map((slot, i) => [slot, tied[i]])
  const body = bind(head[0], tied.slice(slots.length))
  const replaced = replace(body, pairs, scope)

  self[0] = self
  self[1] = tie(replaced, scope, bind, [[head, tied, focus], ...calls])

  return focus
}

const flatDefinition = shape =>
  Array.isArray(shape) && shape.length >= 2 && shape.slice(1).every(symbol)
    ? [shape[0], shape.slice(1)]
    : null

const spineDefinition = (shape, scope, slots = []) =>
  Array.isArray(shape) && shape.length === 2 && symbol(shape[1])
    && !binding(shape[1], scope.names)
    ? spineDefinition(shape[0], scope, [shape[1], ...slots])
    : slots.length ? [shape, slots] : null

const definitionShape = (shape, scope) => {
  const flatShape = flatDefinition(shape)
  const spineShape = spineDefinition(shape, scope)

  if (spineShape && unique(spineShape[1])
      && (!flatShape || spineShape[1].length > flatShape[1].length))
    return spineShape
  return flatShape ?? spineShape
}

const define = ([name, shape], scope) => {
  const parts = definitionShape(shape, scope)
  if (!parts)
    err('Definitions need a body and at least one slot')

  const [body, marks] = parts
  const fn = []
  const local = []
  const slots = marks.map(mark => {
    if (binding(mark, local)) err('Definition slots must be unique')

    const slot = []
    slot[0] = slot
    slot[1] = fn
    local.push([mark, slot])
    return slot
  })

  scope.names.push([name, fn])
  fn.push(build(body, [local, scope.names]), ...slots)
  return fn
}

export const compile = (source, { output = 'flat' } = {}) => {
  const bind = outputs[output]
  if (!bind) err(`Unknown output: ${output}`)

  const scope = { names: [] }
  let focus

  read(tokenize(source)).forEach(form => {
    if (sourceDefinition(form, scope)) {
      define(form, scope)
      focus = undefined
      return
    }

    focus = tie(build(form, [scope.names]), scope, bind)
  })

  if (focus === undefined) err('Missing focus')
  return focus
}

const paths = (expr, path = '$', seen = new Map()) =>
  !Array.isArray(expr) ? expr
    : seen.has(expr) ? seen.get(expr)
      : (seen.set(expr, path),
        expr.map((item, i) => paths(item, `${path}.${i}`, seen)))

export const serialize = form =>
  JSON.stringify(paths(form))
    ?.replace(/[\[]/g, '(').replace(/[\]]/g, ')')
    .replace(/,/g, ' ').replace(/"/g, '')

export const observe = (pair, trace) => (
  trace?.(pair),
  !Array.isArray(pair) ? pair
    : pair[0] === pair ? pair[1]
      : observe(pair[0], trace))

let N = 0
const trace = form => console.log(N++, serialize(form), '\n')

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync } = await import('node:fs')
  const args = process.argv.slice(2)
  const mode = args.find(arg => outputs[arg])
  const file = args.find(arg => !outputs[arg])
    ?? new URL('./core.lisp', import.meta.url)

  const root = compile(readFileSync(file, 'utf-8'),
                       { output: mode })
  observe(observe(root, trace))
}
