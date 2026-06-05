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
  const startsWith = (form, node, seen = []) =>
    form === node ||
      (Array.isArray(form) && !seen.includes(form) &&
        startsWith(form[0], node, [...seen, form]))

  const isRoot = form =>
    Array.isArray(form) && startsWith(form[0], form)

  const connect = (form, name, node) => {
    if (form === name) return node
    if (isSymbol(form) || isRoot(form)) return form

    form.forEach((part, i) => { form[i] = connect(part, name, node) })
    return form
  }

  const application = form =>
    form.slice(1).reduce((left, right) => [left, right], form[0])

  const expression = form =>
    isSymbol(form) || isRoot(form) || form.length === 0
      ? form
      : application(form.map(expression))

  const pattern = form =>
    isSymbol(form)
      ? [form, []]
      : isSymbol(form[0])
        ? [form[0], form.slice(1)]
        : (([name, args]) => [name, [...args, form[1]]])(pattern(form[0]))

  const define = (def, rest, result) => {
    const [name, argNames] = pattern(def[0])
    const args = argNames.map(() => [])

    def[0] = application([def, ...args])
    argNames.forEach((argName, i) => { def[1] = connect(def[1], argName, args[i]) })

    def[1] = expression(connect(def[1], name, def))
    connect(rest, name, def)
    return connect(result, name, def)
  }

  const $let = form => {
    const [bindings, body] = form.length === 1 ? form[0] : form

    return expression(
      bindings.reduce((result, def, i) =>
        define(def, bindings.slice(i + 1), result),
        body))
  }

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
// trace(observe(graph))
trace(graph)

// ()
const I = []

// (() ())
I[0] = I
I[1] = I

// (() x) -> x
I[1][0] = I
I[1][1] = 'x'
// trace(I, 'I', observe(I))

// ((() x) y) -> x
const K = []
K[0] = K
K[1] = 'y'
K[0][0] = K
K[0][1] = 'x'
// trace(K, 'K', observe(K))

const x = 'x'
const y = 'y'
const z = 'z'

const S = []
const Sx = [S, x]
const Sxy = [Sx, y]
const Sxyz = [Sxy, z]

// Define S's reduction destination rule by identity
// When the left spine reduces down to S, it projects the application tree
S[0] = Sxyz // Loops back to allow continuous evaluation
S[1] = [ [x, z], [y, z] ]

// trace(Sxyz, 'S', observe(Sxyz))

const Z = []
Z[0] = []
Z[1] = 'x'
Z[0][0] = Z
Z[0][1] = Z

// const Z_1 = observe(Z)
// const Z_2 = observe(Z_1)
// const Z_3 = observe(Z_2)
// trace(Z)
// trace(Z_1)
// trace(Z_2)
