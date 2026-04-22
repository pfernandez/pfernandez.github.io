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
 * - Compiler expansion for definitions
 * - Folding instructions such as `(def S ((0 2) (1 2)))`
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */
const isList = Array.isArray
const isPair = node => isList(node) && node.length === 2
const isFixed = node => isPair(node) && node[0] === node
const foldSlots = new WeakMap()

// Compiler-only fold instructions for higher-order source terms. `compile`
// lowers and reifies them before returning, so `observe` still sees pairs.
const foldValues = new WeakMap()

const tokenize = source =>
  source.replace(/;.*$/gm, '').match(/[()]|[^()\s]+/g) ?? []

const fixed = (value, slot, group) => {
  const pair = []
  pair[0] = pair
  pair[1] = value
  foldSlots.set(pair, { group, slot, value })
  return pair
}

const recursiveFixed = fill => {
  const pair = []
  pair[0] = pair
  pair[1] = undefined
  pair[1] = fill(pair)
  return pair
}

const foldValue = meta => {
  const value = {}
  foldValues.set(value, meta)
  return value
}

const applyArgs = (head, args) =>
  args.reduce((left, right) => [left, right], head)

const applySerializedArgs = (head, args) =>
  args.reduce((left, right) => `(${left} ${right})`, head)

const applyFoldArgs = (head, args) =>
  args.reduce(applyFoldValue, head)

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
  if (params.some(param => typeof param !== 'string')) {
    throw new Error('defn params must be symbols')
  }
  return params
}

const collectForms = (tokens, index = 0, forms = []) => {
  if (index >= tokens.length) return forms
  const [form, next] = read(tokens, index)
  return collectForms(tokens, next, [...forms, form])
}

const collectProgram = source => collectForms(tokenize(source))

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
  const { env, expr } = forms.reduce((program, form) => {
    const definition = normalizeDefinitionForm(form)
    return definition
      ? { ...program,
          env: new Map(program.env).set(definition.name, definition) }
      : { ...program, expr: form }
  }, { env: new Map(), expr: null })

  if (expr === null) throw new Error('Program must end with an expression')
  return { env, expr }
}

const application = expr => {
  if (!isList(expr) || expr.length === 0) return [expr, []]

  const [head, ...rest] = expr
  const [base, args] = application(head)
  return [base, [...args, ...rest]]
}

const mergeCounts = (left, right) =>
  [...right].reduce((counts, [group, count]) =>
    new Map(counts).set(group, (counts.get(group) ?? 0) + count),
  left)

const visibleFoldCounts = node => {
  const meta = foldSlots.get(node)
  if (meta) return new Map([[meta.group, 1]])
  if (!isPair(node) || isFixed(node)) return new Map()
  return mergeCounts(visibleFoldCounts(node[0]), visibleFoldCounts(node[1]))
}

const childFoldCounts = node =>
  isPair(node) && !isFixed(node)
    ? [visibleFoldCounts(node[0]), visibleFoldCounts(node[1])]
    : []

const foldBoundaryGroup = (node, totals, counts, activeGroups) =>
  [...counts.keys()].find(group =>
    activeGroups.has(group) &&
    counts.get(group) === totals.get(group) &&
    !childFoldCounts(node).some(child => child.get(group) === totals.get(group)))

const collectFoldClosures = (node, group) => {
  const meta = foldSlots.get(node)
  if (meta?.group === group) return [node]
  if (!isPair(node) || isFixed(node)) return []
  return [...collectFoldClosures(node[0], group),
          ...collectFoldClosures(node[1], group)]
}

const uniqueByIdentity = values =>
  values.filter((value, index) => values.indexOf(value) === index)

const collectSlotIndexes = node => {
  if (isFixed(node)) return null
  if (isList(node)) {
    if (node.length !== 2) return null
    const left = collectSlotIndexes(node[0])
    const right = collectSlotIndexes(node[1])
    return left && right ? [...left, ...right] : null
  }
  if (typeof node !== 'number') return null
  if (!Number.isInteger(node) || node < 0) {
    throw new Error('Slot templates must use non-negative integer slots')
  }
  return [node]
}

const slotProfile = (template, arity = null) => {
  const indexes = collectSlotIndexes(template)
  if (!indexes) return null

  const slots = [...new Set(indexes)].sort((a, b) => a - b)
  const sparse = slots.some((slot, index) => slot !== index)
  if (arity === null && sparse) {
    throw new Error('Slot templates must use dense slots from 0')
  }

  return { arity: arity ?? slots.length }
}

const paramTemplate = (expr, locals) => {
  if (!isList(expr)) {
    return locals.has(expr)
      ? { node: locals.get(expr), pure: true }
      : { node: expr, pure: false }
  }

  if (expr.length === 0) return { node: [], pure: false }

  const terms = expr.map(term => paramTemplate(term, locals))
  return {
    node: applyArgs(terms[0].node, terms.slice(1).map(term => term.node)),
    pure: terms.every(term => term.pure)
  }
}

const slotLocals = params =>
  new Map(params.map((param, index) => [param, index]))

const instantiateTemplate = (template, args, compileArg, arity = null) => {
  const profile = slotProfile(template, arity)
  if (!profile || args.length < profile.arity) return null

  const group = {}
  const slots = args.slice(0, profile.arity)
    .map((arg, slot) => fixed(compileArg(arg), slot, group))
  const fill = node =>
    isList(node) ? [fill(node[0]), fill(node[1])] : slots[node]
  const body = fill(template)
  const rest = args.slice(profile.arity).map(compileArg)

  return applyArgs(body, rest)
}

const instantiateFold = (template, args, arity) =>
  instantiateTemplate(template, args, value => value, arity)

const atomBoundary = node => !isList(node)

const sharedContinuation = node =>
  isPair(node) && isPair(node[0]) && isPair(node[1]) && node[0][1] === node[1][1]

const foldForDefinition = (name, entry, env, stack) => {
  if (entry.kind === 'def') {
    const profile = slotProfile(entry.body)
    return profile
      ? foldValue({ name, template: entry.body, arity: profile.arity, args: [] })
      : null
  }

  if (entry.params.length === 0) return null

  const { node: template, pure } =
    paramTemplate(entry.body, slotLocals(entry.params))

  return pure
    ? foldValue({ name, template, arity: entry.params.length, args: [] })
    : foldValue({
        name,
        entry,
        env,
        stack,
        arity: entry.params.length,
        args: []
      })
}

const resolveDefinition = (name, env, stack) => {
  const entry = env.get(name)
  if (!entry) return null
  if (stack.includes(name)) {
    throw new Error(`Recursive definitions are not supported: ${name}`)
  }
  if (entry.kind === 'def' && typeof entry.body === 'string' &&
      env.has(entry.body)) {
    return resolveDefinition(entry.body, env, [...stack, name])
  }
  return { name, entry }
}

const compileExpr = (expr, env, locals = new Map(), stack = []) => {
  if (!isList(expr)) {
    if (typeof expr !== 'string') return expr

    if (locals.has(expr)) return locals.get(expr)

    const resolved = resolveDefinition(expr, env, stack)
    if (!resolved) return expr

    const { name, entry } = resolved
    const fold = foldForDefinition(name, entry, env, stack)
    if (fold) return fold

    return compileExpr(entry.body, env, new Map(), [...stack, name])
  }

  if (expr.length === 0) return []

  const [head, args] = application(expr)
  const resolved = typeof head === 'string'
    ? resolveDefinition(head, env, stack)
    : null
  const compileArg = arg => compileExpr(arg, env, locals, stack)

  if (resolved?.entry.kind === 'defn' &&
      args.length >= resolved.entry.params.length) {
    const params = resolved.entry.params
    const { node: template, pure } =
      paramTemplate(resolved.entry.body, slotLocals(params))
    const templated = pure
      ? instantiateTemplate(template, args, compileArg, params.length)
      : null

    if (templated) return templated

    const group = {}
    const localArgs = args.slice(0, params.length)
      .map((arg, slot) => fixed(compileArg(arg), slot, group))
    const nextLocals = new Map([...locals,
                                ...params.map((param, index) =>
                                  [param, localArgs[index]])])
    const body = compileExpr(resolved.entry.body,
                             env,
                             nextLocals,
                             [...stack, resolved.name])
    return applyArgs(body, args.slice(params.length).map(compileArg))
  }

  const templated = resolved?.entry.kind === 'def'
    ? instantiateTemplate(resolved.entry.body, args, compileArg)
    : null
  if (templated) return templated

  const compiledHead = compileExpr(head, env, locals, stack)
  const compiledArgs = args.map(compileArg)
  if (isFoldValue(compiledHead)) {
    return applyFoldArgs(compiledHead, compiledArgs)
  }

  return instantiateTemplate(compiledHead, args, compileArg) ??
    applyArgs(compiledHead, compiledArgs)
}

const isFoldValue = value =>
  Boolean(value) && typeof value === 'object' && foldValues.has(value)

const hasTemplate = meta =>
  Object.hasOwn(meta, 'template')

const applyFoldValue = (value, arg) => {
  const meta = foldValues.get(value)
  const args = [...meta.args, arg]
  if (args.length < meta.arity) return foldValue({ ...meta, args })
  if (hasTemplate(meta)) return instantiateFold(meta.template, args, meta.arity)

  const group = {}
  const localArgs = args.slice(0, meta.arity)
    .map((value, slot) => fixed(value, slot, group))
  const locals = new Map(meta.entry.params.map((param, index) =>
    [param, localArgs[index]]))
  const body = compileExpr(meta.entry.body,
                           meta.env,
                           locals,
                           [...meta.stack, meta.name])
  return applyArgs(body, args.slice(meta.arity))
}

const foldHead = (value, seen = new WeakSet()) => {
  if (isFoldValue(value)) return value
  if (!isFixed(value) || seen.has(value)) return null
  seen.add(value)
  return foldHead(value[1], seen)
}

const selfApplication = (left, right) =>
  isFixed(left) && left === right

const lowerFoldApplications = value => {
  if (!isPair(value) || isFixed(value)) return value

  const left = lowerFoldApplications(value[0])
  const head = foldHead(left)
  if (head && selfApplication(left, value[1])) {
    return recursiveFixed(point =>
      lowerFoldApplications(applyFoldValue(head, point)))
  }
  if (head && !selfApplication(left, value[1])) {
    return lowerFoldApplications(applyFoldValue(head, value[1]))
  }

  const right = lowerFoldApplications(value[1])
  return left === value[0] && right === value[1] ? value : [left, right]
}

const reifiedFoldValue = (value, seen) => {
  const meta = foldValues.get(value)
  return applyArgs(meta.name, meta.args.map(arg => reifyFoldValues(arg, seen)))
}

const reifiedFixed = (value, seen) => {
  const meta = foldSlots.get(value)
  const next = []
  next[0] = next
  seen.set(value, next)
  next[1] = reifyFoldValues(lowerFoldApplications(value[1]), seen)
  if (meta) foldSlots.set(next, { ...meta, value: next[1] })
  return next
}

const reifiedPair = (value, seen) => {
  const next = [null, null]
  seen.set(value, next)
  next[0] = reifyFoldValues(value[0], seen)
  next[1] = reifyFoldValues(value[1], seen)
  return next
}

const reifyFoldValues = (value, seen = new WeakMap()) => {
  if (isFoldValue(value)) return reifiedFoldValue(value, seen)
  if (!isPair(value)) return value

  const existing = seen.get(value)
  if (existing) return existing
  return isFixed(value)
    ? reifiedFixed(value, seen)
    : reifiedPair(value, seen)
}

/**
 * Parses one canonical binary S-expression into nested JS arrays, numbers,
 * and strings.
 *
 * `parse` is the strict single-term reader used by tests and by plain pair
 * round-tripping: every list must be either `()` or a two-item pair. It does
 * not understand program forms, n-ary application, or definitions; use
 * `compile` for full source programs.
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
 * Compiles a multi-form source program to the pair graph consumed by
 * `observe`.
 *
 * Source programs may contain `(def name body)` aliases, numeric folding
 * definitions such as `(def S ((0 2) (1 2)))`, `(defn name (x ...) body)`
 * functions, and one final expression. N-ary source applications are lowered
 * to left-associated binary pairs. Fully applied numeric templates and
 * parameter-only `defn` bodies lower through the same folding path: each slot
 * becomes one shared fixed-point closure carrying hidden fill-order metadata
 * for `serialize`. Named functions can be staged as compiler-only fold values
 * while lowering higher-order source expressions, but those values are reified
 * before this function returns. Template bodies lower directly; other `defn`
 * bodies still receive fixed-point locals, so their arguments exist in the
 * graph even when the body also contains ordinary symbols. Partial or
 * unresolved applications remain ordinary left-associated pairs. When delayed
 * source self-application would otherwise expand forever during compilation,
 * the compiler ties a real fixed-point pair so `observe` sees the loop.
 *
 * Returns the thrown error after logging it, matching `parse` and preserving
 * the test-facing API.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const compile = source => {
  try {
    const forms = collectProgram(source)
    if (!forms.length) return []
    const { env, expr } = programTable(forms)
    return reifyFoldValues(lowerFoldApplications(compileExpr(expr, env)))
  }
  catch (error) {
    console.error(error)
    return error
  }
}

const canonicalSerialize = (pair, slots = new Map()) => {
  if (isFixed(pair)) {
    if (!slots.has(pair)) slots.set(pair, slots.size)
    return String(slots.get(pair))
  }

  if (isList(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${canonicalSerialize(pair[0], slots)} ${canonicalSerialize(pair[1], slots)})`
  }

  return String(pair)
}

const activeFoldGroups = (node, blocked = false) => {
  const meta = foldSlots.get(node)
  const groups = meta && !blocked ? [meta.group] : []
  if (!isPair(node) || isFixed(node)) return new Set(groups)

  const sharedGroups = !blocked && sharedContinuation(node)
    ? visibleFoldCounts(node[0][1]).keys()
    : []

  return new Set([...groups,
                  ...sharedGroups,
                  ...activeFoldGroups(node[0], blocked),
                  ...activeFoldGroups(node[1], blocked || atomBoundary(node[0]))])
}

const serializeFilled = pair => {
  const meta = foldSlots.get(pair)
  if (meta) return serializeFilled(meta.value)

  if (isList(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${serializeFilled(pair[0])} ${serializeFilled(pair[1])})`
  }

  return String(pair)
}

const serializeFoldTemplate = (pair, group, slots, activeGroups) => {
  const meta = foldSlots.get(pair)
  if (meta?.group === group) return String(slots.get(pair))
  if (meta) {
    return activeGroups.has(meta.group)
      ? serializeProjected(pair, visibleFoldCounts(pair), activeGroups)
      : serializeFilled(meta.value)
  }
  if (isFixed(pair)) return canonicalSerialize(pair)

  if (isList(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${serializeFoldTemplate(pair[0], group, slots, activeGroups)} ${serializeFoldTemplate(pair[1], group, slots, activeGroups)})`
  }

  return String(pair)
}

const serializeFold = (pair, group, activeGroups) => {
  const closures = uniqueByIdentity(collectFoldClosures(pair, group))
    .sort((left, right) => foldSlots.get(left).slot - foldSlots.get(right).slot)
  const slots = new Map(closures.map((closure, index) => [closure, index]))
  const template = serializeFoldTemplate(pair, group, slots, activeGroups)
  const args = closures.map(closure => serialize(foldSlots.get(closure).value))

  return applySerializedArgs(template, args)
}

const serializeProjected = (
  pair,
  totals = visibleFoldCounts(pair),
  activeGroups = activeFoldGroups(pair),
) => {
  const meta = foldSlots.get(pair)
  if (meta && !activeGroups.has(meta.group)) return serializeFilled(meta.value)

  const counts = visibleFoldCounts(pair)
  const group = foldBoundaryGroup(pair, totals, counts, activeGroups)
  if (group) return serializeFold(pair, group, activeGroups)
  if (isFixed(pair)) return canonicalSerialize(pair)

  if (isList(pair)) {
    if (pair.length === 0) return '()'
    if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
    return `(${serializeProjected(pair[0], totals, activeGroups)} ${serializeProjected(pair[1], totals, activeGroups)})`
  }

  return String(pair)
}

/**
 * Serializes a term to the Lisp-facing folding-instruction notation.
 *
 * Plain atoms, empty lists, and ordinary pairs serialize as canonical binary
 * S-expressions. Compiler-created fixed-point argument closures carry hidden
 * fill-order metadata. Active closures serialize as reversible folding
 * instructions by replacing the remaining closures with dense slot numbers and
 * appending their stored argument payloads in fill order. A closure is active
 * when it remains on an observer-visible path or is the shared continuation of
 * the current pair shape.
 *
 * This projection is intentionally not a literal object-graph dump. The graph
 * still contains shared self-referential closures, and `observe` still rewrites
 * those closures by identity. The folding form is the paper/worked-example
 * view: repeated slot numbers describe where the same remaining argument will
 * be folded, while the staged arguments after the template show the values
 * already present inside the closure payloads.
 *
 * Passive compiler closures, such as arguments under an atom-headed pair that
 * the observer will not enter, serialize as their filled source values. This
 * keeps settled source-level terms readable without giving `observe` any
 * knowledge of definitions or folds. Manually constructed closures without
 * compiler metadata fall back to traversal-local labels so serialization
 * remains finite for arbitrary pair graphs.
 *
 * @param {*} pair
 * @returns {string}
 */
export const serialize = pair =>
  visibleFoldCounts(pair).size
    ? serializeProjected(pair)
    : canonicalSerialize(pair)
