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
  const functions = []
  const active = []

  const reaches = (form, node, seen = []) =>
    form === node ||
      (Array.isArray(form) && !seen.includes(form) &&
       reaches(form[0], node, [...seen, form]))

  const isRedex = form =>
    Array.isArray(form) && reaches(form[0], form)

  const isFunction = form =>
    functions.includes(form)

  const same = (left, right) =>
    left.length === right.length && left.every((item, i) => item === right[i])

  const apply = ([head, ...args]) =>
    args.reduce((left, right) => [left, right], head)

  const flat = form =>
    isSymbol(form) || isRedex(form) || isFunction(form) || form.length === 0
      ? [form]
      : form.length === 2 && Array.isArray(form[0])
        ? [...flat(form[0]), form[1]]
        : form

  const connect = (form, name, node) => {
    if (form === name) return node
    if (isSymbol(form) || isFunction(form)) return form

    form.forEach((part, i) => { form[i] = connect(part, name, node) })
    return form
  }

  const instantiate = (form, pairs) => {
    const pair = pairs.find(([from]) => form === from)

    return pair
      ? pair[1]
      : isSymbol(form) || isRedex(form) || isFunction(form)
        ? form
        : form.map(item => instantiate(item, pairs))
  }

  const redex = (head, args) => {
    const params = head[0]
    const seen = active.find(call => call[0] === head && same(call[1], args))
    if (seen) return seen[2]

    const root = []
    const focus = apply([root, ...args])
    const body = args.length > params.length
      ? apply([head[1], ...args.slice(params.length)])
      : head[1]

    active.push([head, args, focus])
    root[0] = focus
    root[1] = expression(
      instantiate(body, params.map((param, i) => [param, args[i]])))
    active.pop()

    return focus
  }

  const expression = form => {
    if (isSymbol(form) || isRedex(form)
        || isFunction(form) || form.length === 0) return form

    const [head, ...args] = flat(form).map(expression)

    return isFunction(head) && args.length >= head[0].length
      ? redex(head, args)
      : apply([head, ...args])
  }

  const define = (def, rest, result) => {
    const [name, ...argNames] = flat(def[0])
    const args = argNames.map(() => [])

    def[0] = args
    functions.push(def)
    argNames.forEach((argName, i) =>
      { def[1] = connect(def[1], argName, args[i]) })

    def[1] = connect(def[1], name, def)
    connect(rest, name, def)
    return connect(result, name, def)
  }

  const $let = ([bindings, body]) =>
    expression(
      bindings.reduce((result, def, i) =>
        define(def, bindings.slice(i + 1), result), body))

  return ast[0] === 'let' ? $let(ast.slice(1)) : expression(ast)
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
