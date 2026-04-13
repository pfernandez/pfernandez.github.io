/**
 * @module sexpr
 *
 * Parsing, serialization, and motif instantiation for pair-encoded
 * S-expressions.
 *
 * We intentionally restrict surface S-expressions to a *binary* discipline:
 * every list must be either `()` or a 2-tuple `(a b)`. This keeps the output
 * isomorphic to a full binary tree / pairs encoding.
 *
 * Supported:
 * - Binary expressions: `(a b)` → `['a', 'b']`
 * - Program sources with `(def ...)` / `(defn ...)` forms and one final
 *   expression
 * - Numbers: `42` → `42`
 * - Symbols: everything else as strings
 * - Line comments starting with `;`
 * - Building terms by replacing numeric leaves with reverse De Bruijn slots
 *   collected from the surrounding left-associated application spine
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */


const isPair = node => Array.isArray(node) && node.length === 2
const isList = Array.isArray

const tokenize = source =>
  source.replace(/;.*$/gm, '').match(/[()]|[^()\s]+/g) ?? []

const clone = node =>
  isList(node) ? node.map(clone) : node

const maxSlot = node => {
  if (typeof node === 'number') return node
  if (!isPair(node)) return -1
  return Math.max(maxSlot(node[0]), maxSlot(node[1]))
}

const unapply = node =>
  isPair(node) && maxSlot(node[1]) < 0
    ? (([head, args]) => [head, [...args, node[1]]])(unapply(node[0]))
    : [node, []]

const fill = (node, args) => {
  if (typeof node === 'number') return args[node]
  if (!isPair(node)) return node
  return [fill(node[0], args), fill(node[1], args)]
}

const rebuild = (head, args) =>
  args.reduce((outer, arg) => [outer, arg], head)

const consumeFirst = (node, arg) => {
  if (typeof node === 'number') return node === 0 ? arg : node - 1
  if (!isPair(node)) return node
  return [consumeFirst(node[0], arg), consumeFirst(node[1], arg)]
}

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

    return clone(expandWithEnv(entry.body,
                               env,
                               entry.params,
                               [...stack, expr]))
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
 * Parses a multi-form program source, expands `(def ...)` / `(defn ...)`
 * definitions, and lowers the final expression to binary pairs.
 *
 * `defn` parameters become fill-order numeric slots: `(defn S (x y z) ...)`
 * lowers `x -> 0`, `y -> 1`, `z -> 2`.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const parseProgram = source => {
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

/**
 * Replaces numeric leaves in the application head with shared inputs gathered
 * from the surrounding left-associated application spine, treating numbers as
 * reverse De Bruijn slots. Used inputs are consumed by the head; any unused
 * outer inputs remain outside the built result.
 *
 * @param {*} expr
 * @returns {*}
 */
export const build = expr => {
  const [head, args] = unapply(expr)
  if (!args.length) return expr

  const used = maxSlot(head) + 1
  if (used > args.length) throw new Error(`Unbound slot: ${used - 1}`)

  const built = fill(head, args)
  return rebuild(built, args.slice(used))
}

/**
 * Consumes one input from a left-associated motif application.
 *
 * This mirrors the visualizer in `~/basis` more closely than `build`:
 * one step fills one input, reindexes the remaining slots, and leaves the
 * remaining outer inputs in place.
 *
 * @param {*} expr
 * @returns {*}
 */
export const buildOne = expr => {
  const [head, args] = unapply(expr)
  if (!args.length) return expr

  const slot = maxSlot(head)
  if (slot < 0) return expr

  const used = slot + 1
  if (used > args.length) throw new Error(`Unbound slot: ${used - 1}`)

  return rebuild(consumeFirst(head, args[0]), args.slice(1))
}
