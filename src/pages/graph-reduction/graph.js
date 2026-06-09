// 1. read — parentheses become trees

const tokenize = src =>
  [...src.matchAll(/(;.*$)|"([^"\\]|\\.)*"|[()]|[^()\s]+/gm)]
    .filter(m => !m[1])
    .map(m => {
      const lines = src.slice(0, m.index).split('\n')
      return { text: m[0],
               value: m[0].startsWith('"')
                 ? m[0].slice(1, -1).replace(/\\"/g, '"')
                 : isNaN(m[0]) ? m[0] : Number(m[0]),
               line: lines.length,
               col: lines.at(-1).length + 1 }
    })

const err = (msg, tok) =>
{ throw new Error(tok ? `${msg} at line ${tok.line}, col ${tok.col}` : msg) }

const read = tokens => {
  let index = 0

  const form = () => {
    const token = tokens[index++]
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

// 2. define — a definition is one box: a built body plus its slots;
//    a slot is a pair that loops to itself on the left and points home on the right

const symbol = form =>
  typeof form === 'string'

const binding = (name, bindings) =>
  bindings.find(([mark]) => mark === name)

const lookup = (name, scopes) =>
  binding(name, scopes.flat())?.[1]

const spine = (first, rest) =>
  rest.reduce((form, next) => [form, next], first)

const build = (form, scopes) =>
  !Array.isArray(form)
    ? symbol(form) ? lookup(form, scopes) ?? form : form
    : form.length
      ? spine(build(form[0], scopes),
              form.slice(1).map(item => build(item, scopes)))
      : form

const sourceDefinition = (form, scope) =>
  Array.isArray(form) && form.length === 2
    && symbol(form[0]) && !binding(form[0], scope.names)

const shape = (form, scope, slots = []) =>
  Array.isArray(form) && form.length === 2 && symbol(form[1])
      && !binding(form[1], scope.names) && !slots.includes(form[1])
    ? shape(form[0], scope, [form[1], ...slots])
    : slots.length ? [form, slots] : null

const define = ([name, form], scope) => {
  const parts = shape(form, scope)
  if (!parts) err('Definitions need a body and at least one slot')

  const [body, marks] = parts
  const fn = []
  const local = marks.map(mark => {
    const slot = []
    slot[0] = slot
    slot[1] = fn
    return [mark, slot]
  })

  scope.names.push([name, fn])
  fn.push(build(body, [local, scope.names]), ...local.map(([, slot]) => slot))
}

// 3. stitch — slide down the left edge collecting arguments; filling a box makes
//    a fresh answer: a self-loop whose payload is the body, slots swapped for arguments
// 4. knot — the call being stitched is met again: point back at its answer

const stable = form =>
  Array.isArray(form) && form[0] === form

const bound = (value, bindings) =>
  bindings.some(([, node]) => node === value)

const atom = (form, scope) =>
  !Array.isArray(form) || stable(form) || bound(form, scope.names)

const root = (form, scope, args = []) =>
  atom(form, scope) ? { head: form, args }
    : root(form[0], scope, [form[1], ...args])

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

const knot = (head, args, knots) =>
  knots.find(([fn, seen]) =>
    fn === head
      && seen.length === args.length
      && seen.every((arg, i) => arg === args[i]))

const stitch = (form, scope, knots = []) => {
  if (atom(form, scope)) return form

  const { head, args } = root(form, scope)

  if (!bound(head, scope.names) || args.length < head.length - 1)
    return form.map(item => stitch(item, scope, knots))

  const stitched = args.map(arg => stitch(arg, scope, knots))
  const tied = knot(head, stitched, knots)
  if (tied) return tied[2]

  const self = []
  const focus = spine(self, stitched)
  const pairs = head.slice(1).map((slot, i) => [slot, stitched[i]])
  const body = replace(spine(head[0], stitched.slice(pairs.length)), pairs, scope)

  self[0] = self
  self[1] = stitch(body, scope, [[head, stitched, focus], ...knots])

  return focus
}

export const compile = source => {
  const scope = { names: [] }
  let focus

  for (const form of read(tokenize(source)))
    focus = sourceDefinition(form, scope)
      ? void define(form, scope)
      : stitch(build(form, [scope.names]), scope)

  if (focus === undefined) err('Missing focus')
  return focus
}

// 5. observe — follow left pointers until a pair points at itself; select reads its payload

const paths = (expr, path = '$', seen = new Map()) =>
  !Array.isArray(expr) ? expr
    : seen.has(expr) ? seen.get(expr)
      : (seen.set(expr, path),
        expr.map((item, i) => paths(item, `${path}.${i}`, seen)))

export const serialize = form =>
  JSON.stringify(paths(form))
    ?.replaceAll('[', '(').replaceAll(']', ')')
    .replaceAll(',', ' ').replaceAll('"', '')

export const observe = (pair, trace) => (
  trace?.(pair),
  !Array.isArray(pair) ? pair
    : pair[0] === pair ? pair
      : observe(pair[0], trace))

export const select = found =>
  stable(found) ? found[1] : found

let N = 0
const trace = form => console.log(N++, serialize(form), '\n')

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
