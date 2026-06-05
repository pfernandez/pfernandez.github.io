// import { readFileSync } from 'node:fs'
// import { fileURLToPath } from 'node:url'

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

const pairForm = form =>
  Array.isArray(form) && form.length === 2

const empty = form =>
  Array.isArray(form) && form.length === 0

const parse = tokens => {
  const sourceItems = form =>
    Array.isArray(form) && form.length === 2 && Array.isArray(form[0])
      ? [...sourceItems(form[0]), form[1]]
      : Array.isArray(form) ? form : [form]

  const fixed = form =>
    pairForm(form) && empty(form[0])

  const spine = form =>
    fixed(form) || pairForm(form) && spine(form[1])

  const history = form =>
    pairForm(form) && !fixed(form) && spine(form[1])

  const checkEmpty = form => {
    if (!Array.isArray(form)) return
    if (empty(form)) err('Empty pairs only fix a following form')
    if (empty(form[0])) {
      if (form.length !== 2) err('Empty pairs only fix one following form')
      checkEmpty(form[1])
      return
    }
    form.forEach(checkEmpty)
  }

  const checkHistory = form => {
    if (fixed(form)) return
    if (!pairForm(form[0]) || !Array.isArray(form[0][0]))
      err('Definitions must be pairs')
    if (sourceItems(form[0][0]).length < 2)
      err('Nullary definitions need a runtime identity node')
    checkHistory(form[1])
  }

  // Read tokens into source groups, rejecting forms with no runtime node.
  const result = tokens.reduce(({ ast, stack }, token) => {
    if (token.text === '(') return { ast: [], stack: [...stack, ast] }

    if (token.text !== ')') {
      if (ast === null) return { ast: token.value, stack }
      if (!Array.isArray(ast))
        err('Unexpected token outside of expression', token)
      return { ast: [...ast, token.value], stack }
    }

    if (stack.length === 0) err('Unexpected )', token)

    const parent = stack.at(-1)
    if (parent !== null && !Array.isArray(parent))
      err('Unexpected token outside of expression', token)

    return {
      ast: parent === null ? ast : [...parent, ast],
      stack: stack.slice(0, -1)
    }
  }, { ast: null, stack: [] })

  if (result.stack.length > 0) err('Missing )')
  if (result.ast === null) err('Missing expression')

  checkEmpty(result.ast)
  if (history(result.ast)) checkHistory(result.ast)

  return result.ast
}


const fix = after => {
  const self = []
  self[0] = self
  self[1] = after
  return self
}


const fixedSource = form =>
  Array.isArray(form) && form.length === 2 && empty(form[0])

// Fold source sequences into pair geometry: (a b c) => ((a b) c).
// The source form (() x) becomes a fixed pair with x after it.
const foldSource = form =>
  fixedSource(form) ? fix(foldSource(form[1]))
    : Array.isArray(form)
      ? form.map(foldSource).reduce((before, after) => [before, after])
      : form


const connect = ast => {
  const base = { shapes: [], identities: [], observations: [] }

  // A pair tied back to itself is a node, not another source list to
  // descend into.
  const reaches = (form, node, seen = []) =>
    form === node
      || Array.isArray(form) && !seen.includes(form)
       && reaches(form[0], node, [...seen, form])

  const atom = (form, space) =>
    !Array.isArray(form) || reaches(form[0], form)
      || space.shapes.includes(form)

  const chain = (before, after) =>
    after.reduce((past, next) => [past, next], before)

  // Follow before-links to the root identity, collecting the after-context.
  const root = (form, space, after = []) =>
    atom(form, space)
      ? { before: form, after }
      : root(form[0], space, [form[1], ...after])

  // The before-spine of a definition exposes one exported mark followed by
  // local marks.
  const frontier = (form, marks = []) =>
    Array.isArray(form)
      ? frontier(form[0], [form[1], ...marks])
      : [form, marks]

  // Collapse a matching source mark into its identity node.
  const identify = (form, [mark, node], space) =>
    form === mark ? node
      : atom(form, space) ? form
        : form.map(part => identify(part, [mark, node], space))

  // Fold local identity nodes onto observed after-nodes.
  const fold = (form, pairs, space) =>
    (match => match ? match[1]
      : atom(form, space) ? form
        : form.map(item => fold(item, pairs, space)))(
      pairs.find(([from]) => form === from))

  const tie = (form, space) => {
    if (atom(form, space)) return form

    const { before, after } = root(form, space)
    const tied = after.map(item => tie(item, space))

    // Shapes without enough after-context remain ordinary pair chains.
    if (!space.shapes.includes(before) || tied.length < before[0].length)
      return chain(before, tied)

    // If recursion reaches the same shape and after-context, reuse that focus.
    const observation = space.observations.find(([shape, seen]) =>
      shape === before && seen.length === tied.length
        && seen.every((item, i) => item === tied[i]))
    if (observation) return observation[2]

    // Tie a stable self to the connected output.
    const self = []
    const focus = chain(self, tied)
    const locals = before[0].map((local, i) => [local, tied[i]])
    const output = chain(before[1], tied.slice(before[0].length))

    self[0] = self
    self[1] = tie(
      fold(output, locals, space),
      { ...space,
        observations: [[before, tied, focus], ...space.observations] })

    return focus
  }

  const fixed = form =>
    Array.isArray(form) && form[0] === form

  const definition = form =>
    Array.isArray(form) && form.length === 2 && Array.isArray(form[0])

  const history = form =>
    Array.isArray(form) && form.length === 2
      && definition(form[0]) && (fixed(form[1]) || history(form[1]))

  // The before side exports identities in order, so later shapes can point at
  // earlier ones.
  const define = (space, source) => {
    const def = space.identities.reduce((form, identity) =>
      identify(form, identity, space), source)
    const [mark, localMarks] = frontier(def[0])
    const locals = localMarks.map(() => [])
    const shape = [locals]
    const next = {
      ...space,
      shapes: [...space.shapes, shape],
      identities: [...space.identities, [mark, shape]]
    }

    // Local identity nodes return to their exported shape.
    locals.forEach(local => {
      local[0] = local
      local[1] = shape
    })

    // The output shares identity with its local marks and exported mark.
    shape[1] = identify(
      localMarks.map((localMark, i) => [localMark, locals[i]])
        .reduce((form, identity) => identify(form, identity, next), def[1]),
      [mark, shape],
      next)

    return next
  }

  const connectHistory = (form, space) =>
    fixed(form)
      ? tie(space.identities.reduce((focus, identity) =>
        identify(focus, identity, space), form[1]), space)
      : connectHistory(form[1], define(space, form[0]))

  return history(ast) ? connectHistory(ast, base) : tie(ast, base)
}

export const compile = source =>
  connect(foldSource(parse(tokenize(source))))

const paths = (expr, path = '$', seen = new Map()) =>
  !Array.isArray(expr) ? expr
    : seen.has(expr) ? seen.get(expr)
      : (seen.set(expr, path),
        expr.map((item, i) => paths(item, `${path}.${i}`, seen)))

export const serialize = form =>
  JSON.stringify(paths(form))
    ?.replace(/[\[]/g, '(').replace(/[\]]/g, ')')
    .replace(/,/g, ' ').replace(/"/g, '')

export const observe = (pair, trace) =>
  (trace?.(pair), pair[0] === pair ? pair : observe(pair[0], trace))

// if (process.argv[1] === fileURLToPath(import.meta.url)) {
//   let N = 1
//   const trace = form => console.log(N++, serialize(form), '\n')
//   const root = compile(readFileSync('./core.lisp', 'utf-8'))
//   trace(observe(root))
// }
