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

  const result = tokens.reduce((s, token) =>
    token.text === '('
      ? { ast: [], stack: [...s.stack, s.ast] }
      : token.text !== ')'
        ? s.ast === null
          ? { ast: token.value, stack: s.stack }
          : Array.isArray(s.ast)
            ? { ast: [...s.ast, token.value], stack: s.stack }
            : err('Unexpected token outside of expression', token)
        : s.stack.length === 0
          ? err('Unexpected )', token)
          : s.ast.length === 0
            ? err('Empty pairs have no runtime form', token)
            : (parent =>
              parent !== null && !Array.isArray(parent)
                ? err('Unexpected token outside of expression', token)
                : { ast: parent === null ? s.ast : [...parent, s.ast],
                    stack: s.stack.slice(0, -1) })(s.stack.at(-1)),
    { ast: null, stack: [] })

  if (result.stack.length > 0) err('Missing )')
  if (!Array.isArray(result.ast) || result.ast[0] !== 'let') return result.ast
  if (!Array.isArray(result.ast[1])) err('Let bindings must be a list')

  result.ast[1].forEach(def => {
    if (!Array.isArray(def) || def.length !== 2)
      err('Let bindings must be pairs')
    if (flat(def[0]).length < 2)
      err('Nullary functions need a runtime argument node')
  })

  return result.ast
}


const compile = ast => {
  const scope = { functions: [], names: [], active: [] }

  const reaches = (form, node, seen = []) =>
    form === node ||
      (Array.isArray(form) && !seen.includes(form) &&
       reaches(form[0], node, [...seen, form]))

  const atom = (form, scope) =>
    !Array.isArray(form) || reaches(form[0], form) ||
      scope.functions.includes(form)

  const flat = (form, scope) =>
    atom(form, scope)
      ? [form]
      : form.length === 2 && Array.isArray(form[0])
        ? [...flat(form[0], scope), form[1]]
        : form

  const connect = (form, [name, node], scope) =>
    form === name ? node
      : atom(form, scope) ? form
        : form.map(part => connect(part, [name, node], scope))

  const instantiate = (form, pairs, scope) =>
    (pair => pair ? pair[1]
      : atom(form, scope) ? form
        : form.map(item => instantiate(item, pairs, scope)))(
      pairs.find(([from]) => form === from))

  const expression = (form, scope) => {
    if (atom(form, scope)) return form

    const [head, ...args] = flat(form, scope).map(part =>
      expression(part, scope))

    if (!scope.functions.includes(head) || args.length < head[0].length)
      return args.reduce((left, right) => [left, right], head)

    const seen = scope.active.find(([fn, seenArgs]) =>
      fn === head && seenArgs.length === args.length &&
        seenArgs.every((arg, i) => arg === args[i]))
    if (seen) return seen[2]

    const root = []
    const focus = args.reduce((left, right) => [left, right], root)
    const body = args.length > head[0].length
      ? args.slice(head[0].length)
        .reduce((left, right) => [left, right], head[1])
      : head[1]

    root[0] = focus
    root[1] = expression(
      instantiate(body, head[0].map((param, i) => [param, args[i]]), scope),
      { ...scope, active: [[head, args, focus], ...scope.active] })

    return focus
  }

  return ast[0] === 'let'
    ? (scope => expression(scope.names.reduce((form, pair) =>
      connect(form, pair, scope), ast[2]), scope))(
      ast[1].reduce((scope, source) => {
        const def = scope.names.reduce((form, pair) =>
          connect(form, pair, scope), source)
        const [name, ...argNames] = flat(def[0], scope)
        const args = argNames.map(() => [])
        const fn = [args]
        const next = {
          ...scope,
          functions: [...scope.functions, fn],
          names: [...scope.names, [name, fn]]
        }

        args.forEach(arg => {
          arg[0] = arg
          arg[1] = fn
        })
        fn[1] = connect(
          argNames.map((argName, i) => [argName, args[i]])
            .reduce((form, pair) => connect(form, pair, next), def[1]),
          [name, fn],
          next)

        return next
      }, scope))
    : expression(ast, scope)
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
const graph = compile(ast)
trace(observe(graph))
