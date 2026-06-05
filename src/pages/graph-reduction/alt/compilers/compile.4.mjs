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

const append = (ast, value, token) =>
  ast === null
    ? value
    : Array.isArray(ast)
      ? [...ast, value]
      : err('Unexpected token outside of expression', token)

const parse = tokens => {
  const step = ({ ast, stack }, token) =>
    token.text === '('
      ? { ast: [], stack: [...stack, ast] }
      : token.text === ')'
        ? stack.length === 0
          ? err('Unexpected )', token)
          : { ast: append(stack.at(-1), ast, token), stack: stack.slice(0, -1) }
        : { ast: append(ast, token.value, token), stack }

  const result = tokens.reduce(step, { ast: null, stack: [] })

  return result.stack.length > 0 ? err('Missing )') : result.ast
}

const isSymbol = x => !Array.isArray(x)

const compile = ast => {
  const emptyScope = { functions: [], names: [], active: [] }

  const reaches = (form, node, seen = []) =>
    form === node ||
      (Array.isArray(form) && !seen.includes(form) &&
       reaches(form[0], node, [...seen, form]))

  const isRedex = form =>
    Array.isArray(form) && reaches(form[0], form)

  const isFunction = (form, scope) =>
    scope.functions.includes(form)

  const isAtom = (form, scope) =>
    isSymbol(form) || isRedex(form) || isFunction(form, scope) ||
      form.length === 0

  const same = (left, right) =>
    left.length === right.length && left.every((item, i) => item === right[i])

  const apply = ([head, ...args]) =>
    args.reduce((left, right) => [left, right], head)

  const flat = (form, scope) =>
    isAtom(form, scope)
      ? [form]
      : form.length === 2 && Array.isArray(form[0])
        ? [...flat(form[0], scope), form[1]]
        : form

  const connect = (form, name, node, scope) => {
    if (form === name) return node
    if (isAtom(form, scope)) return form

    return form.map(part => connect(part, name, node, scope))
  }

  const connectAll = (form, pairs, scope) =>
    pairs.reduce((result, [name, node]) =>
      connect(result, name, node, scope), form)

  const instantiate = (form, pairs, scope) => {
    const pair = pairs.find(([from]) => form === from)

    return pair
      ? pair[1]
      : isAtom(form, scope)
        ? form
        : form.map(item => instantiate(item, pairs, scope))
  }

  const redex = (head, args, scope) => {
    const params = head[0]
    const seen = scope.active.find(call =>
      call[0] === head && same(call[1], args))
    if (seen) return seen[2]

    const root = []
    const focus = apply([root, ...args])
    const body = args.length > params.length
      ? apply([head[1], ...args.slice(params.length)])
      : head[1]
    const active = [[head, args, focus], ...scope.active]

    root[0] = focus
    root[1] = expression(
      instantiate(body, params.map((param, i) => [param, args[i]]), scope),
      { ...scope, active })

    return focus
  }

  const expression = (form, scope) => {
    if (isAtom(form, scope)) return form

    const [head, ...args] = flat(form, scope).map(part =>
      expression(part, scope))

    return isFunction(head, scope) && args.length >= head[0].length
      ? redex(head, args, scope)
      : apply([head, ...args])
  }

  const define = (scope, source) => {
    const def = connectAll(source, scope.names, scope)
    const [name, ...argNames] = flat(def[0], scope)
    const args = argNames.map(() => [])
    const fn = [args]
    const next = {
      ...scope,
      functions: [...scope.functions, fn],
      names: [...scope.names, [name, fn]]
    }

    fn[1] = connect(
      connectAll(def[1], argNames.map((argName, i) => [argName, args[i]]),
        next),
      name,
      fn,
      next)

    return next
  }

  const $let = ([bindings, body]) =>
    (scope => expression(connectAll(body, scope.names, scope), scope))(
      bindings.reduce(define, emptyScope))

  return ast[0] === 'let'
    ? $let(ast.slice(1))
    : expression(ast, emptyScope)
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
