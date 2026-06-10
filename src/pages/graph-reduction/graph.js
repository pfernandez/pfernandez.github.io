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

// 2. define — a definition is the picture of its own application, built whole;
//    each mark becomes a slot: a pair that loops to itself and points home

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

const shape = (form, scope, marks = []) =>
  Array.isArray(form) && form.length === 2 && symbol(form[1])
      && !binding(form[1], scope.names) && !marks.includes(form[1])
    ? shape(form[0], scope, [form[1], ...marks])
    : marks.length ? marks : null

const define = ([name, form], scope) => {
  const marks = shape(form, scope)
  if (!marks) err('Definitions need a body and at least one slot')

  const fn = []
  const local = marks.map(mark => {
    const slot = []
    slot[0] = slot
    slot[1] = fn
    return [mark, slot]
  })

  scope.names.push([name, fn])
  fn.push(...build(form, [local, scope.names]))
}

// 3. stitch — slide down the left edge collecting arguments; a definition is any
//    pair whose right side is a slot pointing home, so peel its slots back off to
//    reach the body; filling them makes a fresh answer: a self-loop holding the
//    body with slots swapped for arguments
// 4. knot — the call being stitched is met again: point back at its answer

const stable = form =>
  Array.isArray(form) && form[0] === form

const definition = form =>
  Array.isArray(form) && stable(form[1]) && form[1][1] === form

const atom = form =>
  !Array.isArray(form) || stable(form) || definition(form)

const root = (form, args = []) =>
  atom(form) ? { head: form, args }
    : root(form[0], [form[1], ...args])

const peel = (fn, node = fn, slots = []) =>
  stable(node[1]) && node[1][1] === fn && !slots.includes(node[1])
    ? peel(fn, node[0], [node[1], ...slots])
    : [node, slots]

const replace = (form, pairs, seen = new Map()) => {
  const match = pairs.find(([from]) => form === from)
  if (match) return match[1]
  if (atom(form)) return form
  if (seen.has(form)) return seen.get(form)

  const copy = []
  seen.set(form, copy)
  form.forEach(item => copy.push(replace(item, pairs, seen)))
  return copy
}

const knot = (head, args, knots) =>
  knots.find(([fn, seen]) =>
    fn === head
      && seen.length === args.length
      && seen.every((arg, i) => arg === args[i]))

const stitch = (form, knots = []) => {
  if (atom(form)) return form

  const { head, args } = root(form)
  const parts = definition(head) && peel(head)

  if (!parts || args.length < parts[1].length)
    return form.map(item => stitch(item, knots))

  const [body, slots] = parts
  const stitched = args.map(arg => stitch(arg, knots))
  const tied = knot(head, stitched, knots)
  if (tied) return tied[2]

  const self = []
  const focus = spine(self, stitched)
  const pairs = slots.map((slot, i) => [slot, stitched[i]])
  const filled = replace(spine(body, stitched.slice(slots.length)), pairs)

  self[0] = self
  self[1] = stitch(filled, [[head, stitched, focus], ...knots])

  return focus
}

export const compile = source => {
  const scope = { names: [] }
  let focus

  for (const form of read(tokenize(source)))
    focus = sourceDefinition(form, scope)
      ? void define(form, scope)
      : stitch(build(form, [scope.names]))

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
