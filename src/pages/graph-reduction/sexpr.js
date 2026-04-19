/**
 * @module sexpr
 *
 * Parsing and serialization for pair-encoded S-expressions.
 *
 * We intentionally restrict surface S-expressions to a *binary* discipline:
 * every list must be either `()` or a 2-tuple `(a b)`. This keeps the output
 * isomorphic to a full binary tree / pairs encoding.
 *
 * Supported:
 * - Binary expressions: `(a b)` → `['a', 'b']`
 * - Source programs with `(def ...)` / `(defn ...)` forms and one final
 *   expression
 * - Numbers: `42` → `42`
 * - Symbols: everything else as strings
 * - Line comments starting with `;`
 * - Compiler expansion for definitions while pair-native motifs evolve
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */
const isList = Array.isArray

const tokenize = source =>
  source.replace(/;.*$/gm, '').match(/[()]|[^()\s]+/g) ?? []

const clone = node =>
  isList(node) ? node.map(clone) : node

const wrapParams = (count, body) =>
  count <= 0 ? body : [[], wrapParams(count - 1, body)]

const atom = token => {
  const number = Number(token)
  return Number.isNaN(number) ? token : number
}

const read = (tokens, i = 0) => {
  const token = tokens[i]
  if (token === ')') throw new Error('Unexpected )')
  if (token !== '(') return [atom(token), i + 1]

  const list = []
  let cursor = i + 1

  while (true) {
    if (cursor >= tokens.length) throw new Error('Missing )')
    if (tokens[cursor] === ')') return [list, cursor + 1]
    const [value, next] = read(tokens, cursor)
    list.push(value)
    cursor = next
  }
}

const toBinary = expr => {
  if (!isList(expr)) return expr
  if (expr.length === 0) return []
  if (expr.length !== 2) throw new Error('Lists must have exactly 2 elements')
  return [toBinary(expr[0]), toBinary(expr[1])]
}

const normalizeParamList = params => {
  if (!isList(params)) throw new Error('defn params must be a list')
  params.forEach(param => {
    if (typeof param !== 'string') {
      throw new Error('defn params must be symbols')
    }
  })
  return params
}

const collectProgram = source => {
  const tokens = tokenize(source)
  const forms = []
  let index = 0

  while (index < tokens.length) {
    const [form, next] = read(tokens, index)
    forms.push(form)
    index = next
  }

  return forms
}

const makeProgramEntry = (name, body) => ({ kind: 'def', name, body })
const makeProgramFunction = (name, params, body) =>
  ({ kind: 'defn', name, params, body })

const normalizeDefinitionForm = form => {
  if (!isList(form) || !form.length) return null
  if (form[0] !== 'def' && form[0] !== 'defn') return null

  if (form[0] === 'def') {
    if (form.length < 3) throw new Error('Each form must be (def name body)')
    const [, name, body] = form
    if (typeof name !== 'string') throw new Error('def name must be a symbol')
    return makeProgramEntry(name, body)
  }

  if (form[0] === 'defn') {
    if (form.length < 4) throw new Error('Each form must be (defn name (x ...) body)')
    const [, name, params, body] = form
    if (typeof name !== 'string') throw new Error('defn name must be a symbol')
    return makeProgramFunction(name, normalizeParamList(params), body)
  }
}

const programTable = forms => {
  const env = new Map()
  let expr = null

  forms.forEach(form => {
    const definition = normalizeDefinitionForm(form)
    if (definition) {
      env.set(definition.name, definition)
      return
    }
    expr = form
  })

  if (expr === null) throw new Error('Program must end with an expression')
  return { env, expr }
}

const expandWithEnv = (expr, env, locals = [], stack = []) => {
  if (!isList(expr)) {
    if (typeof expr !== 'string') return expr

    const localIndex = locals.indexOf(expr)
    if (localIndex >= 0) return localIndex

    const entry = env.get(expr)
    if (!entry) return expr

    if (stack.includes(expr)) {
      throw new Error(`Recursive definitions are not supported: ${expr}`)
    }

    if (entry.kind === 'def') {
      return clone(expandWithEnv(entry.body, env, [], [...stack, expr]))
    }

    return clone(wrapParams(entry.params.length,
                            expandWithEnv(entry.body,
                                          env,
                                          entry.params,
                                          [...stack, expr])))
  }

  if (expr.length === 0) return []
  return expr.map(item => expandWithEnv(item, env, locals, stack))
    .slice(1)
    .reduce((left, right) => [left, right],
            expandWithEnv(expr[0], env, locals, stack))
}

/**
 * Parses a binary S-expression into nested JS arrays, numbers, and strings.
 *
 * Returns the thrown error after logging it, to preserve the current parser
 * contract used by the tests.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const parse = source => {
  try {
    const tokens = tokenize(source)
    if (!tokens.length) return []

    const [pair, i] = read(tokens)
    if (i !== tokens.length) throw new Error('Extra content after expression')
    return toBinary(pair)
  }
  catch (error) {
    console.error(error)
    return error
  }
}

/**
 * Compiles a multi-form source program, expands `(def ...)` / `(defn ...)`
 * definitions, and lowers the final expression to binary pairs.
 *
 * This still returns the current wrapper/slot representation while pair-native
 * motif compilation evolves. Tests intentionally avoid depending on the exact
 * local-slot shape.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const compile = source => {
  try {
    const forms = collectProgram(source)
    if (!forms.length) return []
    const { env, expr } = programTable(forms)
    return expandWithEnv(expr, env)
  }
  catch (error) {
    console.error(error)
    return error
  }
}

/**
 * Serializes a parsed term back to canonical binary S-expression form.
 * Numeric leaves remain the public notation for slot motifs.
 *
 * @param {*} pair
 * @returns {string}
 */
export const serialize = pair => {
  if (Array.isArray(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${serialize(pair[0])} ${serialize(pair[1])})`
  }

  return String(pair)
}
