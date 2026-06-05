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
  const flat = form =>
    Array.isArray(form) && form.length === 2 && Array.isArray(form[0])
      ? [...flat(form[0]), form[1]]
      : Array.isArray(form) ? form : [form]

  // Read tokens into the written pair shape, rejecting forms with no runtime node.
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
    if (flat(def[0]).length < 2)
      err('Nullary functions need a runtime argument node')
  })

  return result.ast
}


const connect = ast => {
  const empty = { functions: [], names: [], fixes: [] }

  // A pair tied back to itself is a node, not another source list to descend into.
  const reaches = (form, node, seen = []) =>
    form === node ||
      (Array.isArray(form) && !seen.includes(form) &&
       reaches(form[0], node, [...seen, form]))

  const atom = (form, scope) =>
    !Array.isArray(form) || reaches(form[0], form) ||
      scope.functions.includes(form)

  // Read left-nested application as a head followed by its arguments.
  const flat = (form, scope) =>
    atom(form, scope)
      ? [form]
      : form.length === 2 && Array.isArray(form[0])
        ? [...flat(form[0], scope), form[1]]
        : form

  // Replace matching labels with the node they name.
  const wire = (form, [name, node], scope) =>
    form === name ? node
      : atom(form, scope) ? form
        : form.map(part => wire(part, [name, node], scope))

  // Copy a function body, replacing formal nodes with actual argument nodes.
  const copy = (form, pairs, scope) =>
    (pair => pair ? pair[1]
      : atom(form, scope) ? form
        : form.map(item => copy(item, pairs, scope)))(
      pairs.find(([from]) => form === from))

  const fix = (form, scope) => {
    if (atom(form, scope)) return form

    const [head, ...args] = flat(form, scope).map(part =>
      fix(part, scope))

    // Incomplete applications remain ordinary pairs.
    if (!scope.functions.includes(head) || args.length < head[0].length)
      return args.reduce((left, right) => [left, right], head)

    // If recursion returns to this same point, share the existing fix.
    const open = scope.fixes.find(([fn, seenArgs]) =>
      fn === head && seenArgs.length === args.length &&
        seenArgs.every((arg, i) => arg === args[i]))
    if (open) return open[2]

    // A fix ties the focused application to its connected body.
    const root = []
    const focus = args.reduce((left, right) => [left, right], root)
    const params = head[0].map((param, i) => [param, args[i]])
    const body = args.slice(head[0].length)
      .reduce((left, right) => [left, right], head[1])

    root[0] = focus
    root[1] = fix(
      copy(body, params, scope),
      { ...scope, fixes: [[head, args, focus], ...scope.fixes] })

    return focus
  }

  if (ast[0] !== 'let') return fix(ast, empty)

  // Let names reusable shapes in order, so later shapes can point at earlier ones.
  const scope = ast[1].reduce((scope, source) => {
    const def = scope.names.reduce((form, pair) =>
      wire(form, pair, scope), source)
    const [name, ...argNames] = flat(def[0], scope)
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
    fn[1] = wire(
      argNames.map((argName, i) => [argName, args[i]])
        .reduce((form, pair) => wire(form, pair, next), def[1]),
      [name, fn],
      next)

    return next
  }, empty)

  // Finally connect the let body to its named shapes and expose its first fix.
  return fix(scope.names.reduce((form, pair) =>
    wire(form, pair, scope), ast[2]), scope)
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
const graph = connect(ast)
trace(observe(graph))
