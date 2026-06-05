import { readFileSync } from 'node:fs'

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

const parse = tokens => {
  const sourceItems = form =>
    Array.isArray(form) && form.length === 2 && Array.isArray(form[0])
      ? [...sourceItems(form[0]), form[1]]
      : Array.isArray(form) ? form : [form]

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
    if (ast.length === 0) err('Empty pairs have no runtime form', token)

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
  if (!Array.isArray(result.ast) || result.ast[0] !== 'let') return result.ast
  if (result.ast.length !== 3) err('Let forms need bindings and body')
  if (!Array.isArray(result.ast[1])) err('Let bindings must be a list')

  result.ast[1].forEach(def => {
    if (!Array.isArray(def) || def.length !== 2)
      err('Let bindings must be pairs')
    if (sourceItems(def[0]).length < 2)
      err('Nullary functions need a runtime argument node')
  })

  return result.ast
}


// Expand curried source syntax into left-nested pair geometry.
const curry = form =>
  Array.isArray(form) && form[0] === 'let'
    ? ['let',
       form[1].map(([head, body]) => [curry(head), curry(body)]),
       curry(form[2])]
    : Array.isArray(form)
      ? form.map(curry).reduce((left, right) => [left, right])
      : form


const connect = ast => {
  const empty = { functions: [], names: [], frames: [] }

  // A pair tied back to itself is a node, not another source list to descend into.
  const reaches = (form, node, seen = []) =>
    form === node ||
      (Array.isArray(form) && !seen.includes(form) &&
       reaches(form[0], node, [...seen, form]))

  const atom = (form, scope) =>
    !Array.isArray(form) || reaches(form[0], form) ||
      scope.functions.includes(form)

  const pair = (left, right) => [left, right]

  // Fold a head and right branches back into pair geometry.
  const chain = (head, args) =>
    args.reduce(pair, head)

  // Find the leftmost node, keeping the right branches passed on the way.
  const leftmost = (form, scope, args = []) =>
    atom(form, scope)
      ? { head: form, args }
      : leftmost(form[0], scope, [form[1], ...args])

  // Function heads are pair chains too: (((S x) y) z).
  const signature = (form, args = []) =>
    Array.isArray(form)
      ? signature(form[0], [form[1], ...args])
      : [form, args]

  // Link a matching label to the node it names.
  const link = (form, [name, node], scope) =>
    form === name ? node
      : atom(form, scope) ? form
        : form.map(part => link(part, [name, node], scope))

  // Copy a function body, replacing formal nodes with actual argument nodes.
  const copy = (form, pairs, scope) =>
    (match => match ? match[1]
      : atom(form, scope) ? form
        : form.map(item => copy(item, pairs, scope)))(
      pairs.find(([from]) => form === from))

  const tie = (form, scope) => {
    if (atom(form, scope)) return form

    const { head, args } = leftmost(form, scope)
    const tied = args.map(arg => tie(arg, scope))

    // Shapes without enough arguments remain ordinary pair chains.
    if (!scope.functions.includes(head) || tied.length < head[0].length)
      return chain(head, tied)

    // If recursion reaches the same head and arguments, reuse that focus.
    const frame = scope.frames.find(([fn, seenArgs]) =>
      fn === head && seenArgs.length === tied.length &&
        seenArgs.every((arg, i) => arg === tied[i]))
    if (frame) return frame[2]

    // Tie the focused pair chain to its connected body.
    const root = []
    const focus = chain(root, tied)
    const params = head[0].map((param, i) => [param, tied[i]])
    const body = chain(head[1], tied.slice(head[0].length))

    root[0] = focus
    root[1] = tie(
      copy(body, params, scope),
      { ...scope, frames: [[head, tied, focus], ...scope.frames] })

    return focus
  }

  if (ast[0] !== 'let') return tie(ast, empty)

  // Let names reusable shapes in order, so later shapes can point at
  // earlier ones.
  const scope = ast[1].reduce((scope, source) => {
    const def = scope.names.reduce((form, label) =>
      link(form, label, scope), source)
    const [name, argNames] = signature(def[0])
    const args = argNames.map(() => [])
    const fn = [args]
    const next = {
      ...scope,
      functions: [...scope.functions, fn],
      names: [...scope.names, [name, fn]]
    }

    // Argument nodes return to their function shape.
    args.forEach(arg => {
      arg[0] = arg
      arg[1] = fn
    })

    // The body shares identity with its arguments and its own name.
    fn[1] = link(
      argNames.map((argName, i) => [argName, args[i]])
        .reduce((form, label) => link(form, label, next), def[1]),
      [name, fn],
      next)

    return next
  }, empty)

  // Finally connect the let body to its named shapes and tie the first one.
  return tie(scope.names.reduce((form, label) =>
    link(form, label, scope), ast[2]), scope)
}

const serialize = s =>
  s?.replace(/[\[]/g, '(').replace(/[\]]/g, ')')
    .replace(/,/g, ' ').replace(/"/g, '')

let N = 1
const trace = (console.log(),
  (form, clone = (expr, path = '$', seen = new Map()) =>
    !Array.isArray(expr) ? expr
      : seen.has(expr) ? seen.get(expr)
      : (seen.set(expr, path),
         expr.map((item, i) => clone(item, `${path}.${i}`, seen)))) =>
  console.log(N++, serialize(JSON.stringify(clone(form))), '\n'))

export const observe = focus => {
  const step = pair => (
    trace(pair),
    (pair[0] === focus) ? pair[1] : step(pair[0]))  // pair is one rotation
                                                    // back to root; into focus
  return step(focus)
}

const ast = parse(tokenize(readFileSync('./core.lisp', 'utf-8')))
const graph = connect(curry(ast))
trace(observe(graph))
