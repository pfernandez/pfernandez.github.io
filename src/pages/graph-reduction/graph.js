// Every node is a cell: a two-element array. cell[0] is the function side
// and cell[1] is the argument side, so the application (f x) is the cell
// [f, x]. There are no tags; every role is recognized by shape:
//   atom        both sides point at the cell itself
//   slot        a parameter: itself on the left, its definition on the right
//   answer      itself on the left, a result on the right
//   definition  its right side is a slot pointing back at it

// 1. read — parentheses become nested arrays

// Comments are dropped; every token remembers its line and column.
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

// 2. define — a definition (Name picture) is the picture of a complete call:
//    the body applied to each parameter in turn, so (K ((x x) y)) reads
//    "K applied to x and then y leaves x"

const symbol = form =>
  typeof form === 'string'

// A scope is a list of [name, cell] pairs; first match wins.
const binding = (name, bindings) =>
  bindings.find(([mark]) => mark === name)

const lookup = (name, scopes) =>
  binding(name, scopes.flat())?.[1]

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

// Left-nested application: spine(f, [a, b]) is ((f a) b).
const spine = (first, rest) =>
  rest.reduce((form, next) => [form, next], first)

// A symbol means its binding if it has one, otherwise an atom; a list is
// its head applied to each item in turn.
const build = (form, scopes) =>
  !Array.isArray(form)
    ? symbol(form) && lookup(form, scopes) || intern(form)
    : form.length
      ? spine(build(form[0], scopes),
              form.slice(1).map(item => build(item, scopes)))
      : intern('()')

// A top-level (name form) where name is unbound introduces a definition.
const sourceDefinition = (form, scope) =>
  Array.isArray(form) && form.length === 2
    && symbol(form[0]) && !binding(form[0], scope.names)

// Walk the picture's left edge collecting parameter names, innermost first —
// the order arguments are supplied; null if there are none.
const shape = (form, scope, marks = []) =>
  Array.isArray(form) && form.length === 2 && symbol(form[1])
      && !binding(form[1], scope.names) && !marks.includes(form[1])
    ? shape(form[0], scope, [form[1], ...marks])
    : marks.length ? marks : null

// fn is the picture itself; each parameter becomes a slot pointing back at
// fn. The name binds before the picture builds, so self-reference is a
// cycle, not an expansion.
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

// 3. stitch — reduce: walk a call's function sides to its head; a definition
//    with enough arguments becomes its answer — the body with each slot
//    swapped for its argument
// 4. knot — a call met again while it is being stitched points back at its
//    own answer, so recursion becomes a cycle; stitching is given finite
//    patience — running out means divergence

// Observation stops where the function side is the cell itself: atoms,
// slots, and answers are all stable.
const stable = form =>
  Array.isArray(form) && form[0] === form

// The outermost cell built by define: its argument side is a slot pointing
// back at it.
const definition = form =>
  Array.isArray(form) && !stable(form)
    && stable(form[1]) && form[1][1] === form

// Values need no stitching: stable cells are finished, definitions wait.
const value = form =>
  stable(form) || definition(form)

// Read a left spine as a call: ((K a) b) is head K, args [a, b].
const root = (form, args = []) =>
  value(form) ? { head: form, args }
    : root(form[0], [form[1], ...args])

// Strip parameter applications to reach the body; slots return in the order
// arguments are supplied. A repeated slot belongs to the body, as in M.
const peel = (fn, node = fn, slots = []) =>
  stable(node[1]) && node[1][1] === fn && !slots.includes(node[1])
    ? peel(fn, node[0], [node[1], ...slots])
    : [node, slots]

// Copy with each slot swapped for its argument; values stay shared, and
// seen keeps sharing and cycles intact in the copy.
const replace = (form, swaps, seen = new Map()) => {
  const match = swaps.find(([from]) => form === from)
  if (match) return match[1]
  if (value(form)) return form
  if (seen.has(form)) return seen.get(form)

  const copy = []
  seen.set(form, copy)
  form.forEach(item => copy.push(replace(item, swaps, seen)))
  return copy
}

// An in-progress call of the same definition with identical arguments;
// each knot is [fn, args, focus].
const knot = (head, args, knots) =>
  knots.find(([fn, prior]) =>
    fn === head
      && prior.length === args.length
      && prior.every((arg, i) => arg === args[i]))

// Calls that never repeat would stitch forever; compile sets the budget.
let patience = 0

// A completed call returns its focus: the call's shape with the answer at
// its head, so observation runs to the answer and select reads the result.
// Arguments beyond the slots stay applied to the body.
const stitch = (form, knots = []) => {
  if (value(form)) return form
  if (--patience < 0) err('Stitching never settles')

  const { head, args } = root(form)
  const parts = definition(head) && peel(head)

  if (!parts || args.length < parts[1].length)
    return form.map(item => stitch(item, knots))

  const [body, slots] = parts
  const stitched = args.map(arg => stitch(arg, knots))
  const tied = knot(head, stitched, knots)
  if (tied) return tied[2]

  const answer = []
  const focus = spine(answer, stitched)
  const swaps = slots.map((slot, i) => [slot, stitched[i]])
  const filled = replace(spine(body, stitched.slice(slots.length)), swaps)

  answer[0] = answer
  answer[1] = stitch(filled, [[head, stitched, focus], ...knots])

  return focus
}

// Definitions extend the scope; the last remaining form is the focus.
export const compile = source => {
  const scope = { names: [] }
  let focus

  patience = 1e6

  for (const form of read(tokenize(source)))
    focus = sourceDefinition(form, scope)
      ? void define(form, scope)
      : stitch(build(form, [scope.names]))

  if (focus === undefined) err('Missing focus')
  return focus
}

// 5. observe — follow function sides until a cell points at itself; select
//    reads its argument side; an atom is its own answer and its own payload

// Atoms print as their spelling; a cell met again prints as the path where
// it first appeared, so sharing and cycles stay visible.
const paths = (expr, path = '$', seen = new Map()) =>
  !Array.isArray(expr) ? expr
    : spellings.has(expr) ? spellings.get(expr)
      : seen.has(expr) ? seen.get(expr)
        : (seen.set(expr, path),
          expr.map((item, i) => paths(item, `${path}.${i}`, seen)))

export const serialize = form =>
  JSON.stringify(paths(form))
    ?.replaceAll('[', '(').replaceAll(']', ')')
    .replaceAll(',', ' ').replaceAll('"', '')

export const observe = (pair, trace) => (
  trace?.(pair),
  pair[0] === pair ? pair
    : observe(pair[0], trace))

export const select = found =>
  found[1]

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
