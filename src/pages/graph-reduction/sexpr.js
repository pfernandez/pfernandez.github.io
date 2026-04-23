/**
 * @module sexpr
 *
 * Parsing, folding-template encoding, graph materialization, and serialization
 * for pair-encoded S-expressions.
 *
 * Surface S-expressions are read literally, then `encode` left-associates
 * application and rewrites definitions to one Lisp-facing folding projection.
 * `construct` is the public helper that turns dense numeric folding terms into
 * shared in-memory pair graphs.
 *
 * Supported:
 * - Lists and applications: `(f x y)` → `['f', 'x', 'y']`
 * - Source programs with `(def ...)` / `(defn ...)` forms and one final
 *   expression
 * - Numbers: `42` → `42`
 * - Symbols: everything else as strings
 * - Line comments starting with `;`
 * - Compiler encoding for definitions
 * - Folding instructions such as `(((((0 2) (1 2)) a) b) c)`
 *
 * Intentionally not supported: strings, quoting, dotted pairs, reader macros.
 */
const isList = Array.isArray
const isPair = node => isList(node) && node.length === 2
const isFixed = node => isPair(node) && node[0] === node
const argumentClosures = new WeakMap()
const argumentSlotTemplates = new WeakMap()

/**
 * A Lisp source value after tokenization and list reading.
 *
 * @typedef {SourceForm[]} SourceFormArray
 * @typedef {string | number | SourceFormArray} SourceForm
 */

/**
 * A normalized source definition.
 *
 * @typedef {{
 *   kind: 'def',
 *   name: string,
 *   body: SourceForm
 * }|{
 *   kind: 'defn',
 *   name: string,
 *   params: string[],
 *   body: SourceForm
 * }} ProgramEntry
 */

/**
 * Metadata for one compiler-owned argument slot before graph materialization.
 *
 * @typedef {{
 *   group: object,
 *   slot: number,
 *   value: *
 * }} ArgumentSlotTemplate
 */

/**
 * A staged source-level fold waiting for enough arguments to become a graph.
 *
 * @typedef {{
 *   name: string,
 *   template?: SourceForm,
 *   entry?: ProgramEntry,
 *   env?: Map<string, ProgramEntry>,
 *   stack?: string[],
 *   arity: number,
 *   args: *[]
 * }} StagedFold
 */

// Compiler-only staged folds. Materialization removes them before `compile`
// returns, so `observe` still sees only pairs.
const stagedFolds = new WeakMap()

// Reader.
const tokenize = source =>
  source.replace(/;.*$/gm, '').match(/[()]|[^()\s]+/g) ?? []

// Shared term builders.
const applyArgs = (head, args) =>
  args.reduce((left, right) => [left, right], head)

const applySerializedArgs = (head, args) =>
  args.reduce((left, right) => `(${left} ${right})`, head)

const applyStagedFoldArgs = (head, args) =>
  args.reduce(applyStagedFold, head)

const serializeList = (pair, serializeChild) => {
  if (pair.length === 0) return '()'
  if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
  return `(${serializeChild(pair[0])} ${serializeChild(pair[1])})`
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

const collectForms = (tokens, index = 0, forms = []) => {
  if (index >= tokens.length) return forms
  const [form, next] = read(tokens, index)
  return collectForms(tokens, next, [...forms, form])
}

const readSourceForms = source => collectForms(tokenize(source))

// Graph and compiler-placeholder constructors.
const fixedClosure = value => {
  const pair = []
  pair[0] = pair
  pair[1] = value
  return pair
}

const argumentSlotTemplate = (value, slot, group) => {
  const template = {}
  argumentSlotTemplates.set(template, { group, slot, value })
  return template
}

const cycleTemplate = () => {
  const template = []
  template[0] = template
  return template
}

const withCycleBody = (template, body) => {
  template[1] = body
  return template
}

const stagedFold = meta => {
  const value = {}
  stagedFolds.set(value, meta)
  return value
}

// Program indexing and source normalization.
const normalizeParamList = params => {
  if (!isList(params)) throw new Error('defn params must be a list')
  if (params.some(param => typeof param !== 'string')) {
    throw new Error('defn params must be symbols')
  }
  return params
}

const makeProgramEntry = (name, body) => ({ kind: 'def', name, body })
const makeProgramFunction = (name, params, body) =>
  ({ kind: 'defn', name, params, body })

const isDefinitionForm = form =>
  isList(form) && (form[0] === 'def' || form[0] === 'defn')

const normalizeDefinitionForm = form => {
  if (!isDefinitionForm(form)) return null

  if (form[0] === 'def') {
    if (form.length < 3) throw new Error('Each form must be (def name body)')
    const [, name, body] = form
    if (typeof name !== 'string') throw new Error('def name must be a symbol')
    return makeProgramEntry(name, body)
  }

  if (form[0] === 'defn') {
    if (form.length < 4) {
      throw new Error('Each form must be (defn name (x ...) body)')
    }
    const [, name, params, body] = form
    if (typeof name !== 'string') throw new Error('defn name must be a symbol')
    return makeProgramFunction(name, normalizeParamList(params), body)
  }
}

const indexProgram = forms => {
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

// Source encoding to staged folds.
const application = expr => {
  if (!isList(expr) || expr.length === 0) return [expr, []]

  const [head, ...rest] = expr
  const [base, args] = application(head)
  return [base, [...args, ...rest]]
}

const collectSlotIndexes = node => {
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

const functionLocals = (params, args, fixedArg) =>
  new Map(params.map((param, index) => [param, fixedArg(args[index], index)]))

const encodeTemplateApplication = (template, args, encodeArg, arity = null) => {
  const profile = slotProfile(template, arity)
  if (!profile || args.length < profile.arity) return null

  const group = {}
  const slots = args.slice(0, profile.arity)
    .map((arg, slot) => argumentSlotTemplate(encodeArg(arg), slot, group))
  const fill = node =>
    isList(node) ? [fill(node[0]), fill(node[1])] : slots[node]
  const body = fill(template)
  const rest = args.slice(profile.arity).map(encodeArg)

  return applyArgs(body, rest)
}

const encodeFoldTemplate = (template, args, arity) =>
  encodeTemplateApplication(template, args, value => value, arity)

const templateForDefinition = entry => {
  if (entry.kind === 'def') {
    const profile = slotProfile(entry.body)
    return profile && { template: entry.body, arity: profile.arity }
  }

  if (entry.params.length === 0) return null

  const { node: template, pure } =
    paramTemplate(entry.body, slotLocals(entry.params))

  return pure && { template, arity: entry.params.length }
}

const stagedFoldForDefinition = (name, entry, env, stack) => {
  const template = templateForDefinition(entry)
  if (template) return stagedFold({ name, ...template, args: [] })

  return entry.kind === 'defn' && entry.params.length
    ? stagedFold({
      name,
      entry,
      env,
      stack,
      arity: entry.params.length,
      args: []
    })
    : null
}

const resolveDefinition = (name, env, stack) => {
  const entry = env.get(name)
  if (!entry) return null
  if (stack.includes(name)) {
    throw new Error(`Recursive definitions are not supported: ${name}`)
  }
  if (entry.kind === 'def' && typeof entry.body === 'string'
      && env.has(entry.body)) {
    return resolveDefinition(entry.body, env, [...stack, name])
  }
  return { name, entry }
}

const hasCompleteFunctionApplication = (resolved, args) =>
  resolved?.entry.kind === 'defn' && args.length >= resolved.entry.params.length

const encodeFunctionApplication = (
  resolved,
  args,
  encodeArg,
  env,
  locals,
  stack
) => {
  const { entry } = resolved
  const { node: template, pure } =
    paramTemplate(entry.body, slotLocals(entry.params))
  const templated = pure
    ? encodeTemplateApplication(template, args, encodeArg, entry.params.length)
    : null

  if (templated) return templated

  const group = {}
  const nextLocals =
    new Map([...locals,
             ...functionLocals(entry.params,
                               args.slice(0, entry.params.length),
                               (arg, slot) =>
                                 argumentSlotTemplate(encodeArg(arg),
                                                      slot,
                                                      group))])
  const body = encodeExpression(entry.body,
                                env,
                                nextLocals,
                                [...stack, resolved.name])
  return applyArgs(body, args.slice(entry.params.length).map(encodeArg))
}

const encodeExpression = (expr, env, locals = new Map(), stack = []) => {
  if (!isList(expr)) {
    if (typeof expr !== 'string') return expr

    if (locals.has(expr)) return locals.get(expr)

    const resolved = resolveDefinition(expr, env, stack)
    if (!resolved) return expr

    const { name, entry } = resolved
    const fold = stagedFoldForDefinition(name, entry, env, stack)
    if (fold) return fold

    return encodeExpression(entry.body, env, new Map(), [...stack, name])
  }

  if (expr.length === 0) return []

  const [head, args] = application(expr)
  const resolved = typeof head === 'string' && !locals.has(head)
    ? resolveDefinition(head, env, stack)
    : null
  const encodeArg = arg => encodeExpression(arg, env, locals, stack)

  if (hasCompleteFunctionApplication(resolved, args)) {
    return encodeFunctionApplication(resolved,
                                     args,
                                     encodeArg,
                                     env,
                                     locals,
                                     stack)
  }

  const templated = resolved?.entry.kind === 'def'
    ? encodeTemplateApplication(resolved.entry.body, args, encodeArg)
    : null
  if (templated) return templated

  const encodedHead = encodeExpression(head, env, locals, stack)
  const encodedArgs = args.map(encodeArg)
  if (isStagedFold(encodedHead)) {
    return applyStagedFoldArgs(encodedHead, encodedArgs)
  }

  return encodeTemplateApplication(encodedHead, args, encodeArg)
    ?? applyArgs(encodedHead, encodedArgs)
}

// Staged fold application and recursive knots.
const isStagedFold = value =>
  Boolean(value) && typeof value === 'object' && stagedFolds.has(value)

const isArgumentSlotTemplate = value =>
  Boolean(value)
  && typeof value === 'object'
  && argumentSlotTemplates.has(value)

const hasTemplate = meta =>
  Object.hasOwn(meta, 'template')

const withFoldArg = (meta, arg) =>
  ({ ...meta, args: [...meta.args, arg] })

const completeFoldArgs = meta =>
  meta.args.slice(0, meta.arity)

const remainingFoldArgs = meta =>
  meta.args.slice(meta.arity)

const foldComplete = meta =>
  meta.args.length >= meta.arity

const encodeFunctionBody = (meta, locals) =>
  encodeExpression(meta.entry.body,
                   meta.env,
                   locals,
                   [...meta.stack, meta.name])

const encodeTemplateFold = meta =>
  encodeFoldTemplate(meta.template, meta.args, meta.arity)

const encodeFunctionFold = meta => {
  const group = {}
  const locals = functionLocals(meta.entry.params, completeFoldArgs(meta),
                                (value, slot) =>
                                  argumentSlotTemplate(value, slot, group))
  return applyArgs(encodeFunctionBody(meta, locals), remainingFoldArgs(meta))
}

const encodeCompleteFold = meta =>
  hasTemplate(meta)
    ? encodeTemplateFold(meta)
    : encodeFunctionFold(meta)

const applyStagedFold = (value, arg) => {
  const meta = withFoldArg(stagedFolds.get(value), arg)
  return foldComplete(meta) ? encodeCompleteFold(meta) : stagedFold(meta)
}

const stagedFoldHead = (value, seen = new WeakSet()) => {
  if (isStagedFold(value)) return value
  if (isArgumentSlotTemplate(value)) {
    return stagedFoldHead(argumentSlotTemplates.get(value).value, seen)
  }
  if (!isFixed(value) || seen.has(value)) return null
  seen.add(value)
  return stagedFoldHead(value[1], seen)
}

const selfApplication = (left, right) =>
  left === right

const recursiveStagedFold = (head, applications) => {
  const existing = applications.get(head)
  if (existing) return existing

  const loop = cycleTemplate()
  applications.set(head, loop)
  return withCycleBody(
    loop,
    resolveStagedFolds(applyStagedFold(head, loop), applications)
  )
}

const resolveStagedFolds = (value, applications = new WeakMap()) => {
  if (!isPair(value) || isFixed(value)) return value

  const left = resolveStagedFolds(value[0], applications)
  const head = stagedFoldHead(left)
  if (head && selfApplication(left, value[1])) {
    return recursiveStagedFold(head, applications)
  }
  if (head && !selfApplication(left, value[1])) {
    return resolveStagedFolds(applyStagedFold(head, value[1]), applications)
  }

  const right = resolveStagedFolds(value[1], applications)
  return left === value[0] && right === value[1] ? value : [left, right]
}

// Graph materialization.
const materializeStagedFold = (value, seen) => {
  const meta = stagedFolds.get(value)
  return applyArgs(meta.name, meta.args.map(arg => materializeGraph(arg, seen)))
}

const materializeArgumentSlotTemplate = (value, seen) => {
  const meta = argumentSlotTemplates.get(value)
  const next = fixedClosure(null)
  seen.set(value, next)
  next[1] = materializeGraph(resolveStagedFolds(meta.value), seen)
  argumentClosures.set(next, { ...meta, value: next[1] })
  return next
}

const materializePair = (value, seen) => {
  const next = [null, null]
  seen.set(value, next)
  next[0] = materializeGraph(value[0], seen)
  next[1] = materializeGraph(value[1], seen)
  return next
}

const materializeGraph = (value, seen = new WeakMap()) => {
  const existing = seen.get(value)
  if (existing) return existing
  if (isStagedFold(value)) return materializeStagedFold(value, seen)
  if (isArgumentSlotTemplate(value)) {
    return materializeArgumentSlotTemplate(value, seen)
  }
  if (!isPair(value)) return value

  return materializePair(value, seen)
}

const materializeProgram = forms => {
  if (!forms.length) return []

  const { env, expr } = indexProgram(forms)
  const encoded = encodeExpression(expr, env)
  const folded = resolveStagedFolds(encoded)
  return materializeGraph(folded)
}

// Public projection and construction helpers.
const encodePlainExpression = expr => {
  if (!isList(expr)) return expr
  if (expr.length === 0) return []

  const [head, ...args] = expr
  return applyArgs(encodePlainExpression(head), args.map(encodePlainExpression))
}

const encodeProgramProjection = forms =>
  readSourceForms(serialize(materializeProgram(forms)))[0]

const encodeProgram = forms =>
  !forms.length
    ? []
    : forms.length === 1 && !isDefinitionForm(forms[0])
      ? encodePlainExpression(forms[0])
      : encodeProgramProjection(forms)

const applicationSplits = term =>
  isPair(term)
    ? [[term, []],
       ...applicationSplits(term[0]).map(([head, args]) =>
         [head, [...args, term[1]]])]
    : [[term, []]]

const denseSlotError = error =>
  /dense slots/i.test(error.message)

const constructTemplateApplication = term =>
  applicationSplits(term).reduce((match, [head, args]) => {
    if (match) return match

    try {
      return encodeTemplateApplication(head, args, constructTerm)
    }
    catch (error) {
      if (denseSlotError(error)) return null
      throw error
    }
  }, null)

const constructOrdinaryApplication = term => {
  const [head, args] = application(term)
  const constructedHead = constructTerm(head)
  const constructedArgs = args.map(constructTerm)
  return applyArgs(constructedHead, constructedArgs)
}

const constructTerm = term => {
  if (!isList(term)) return term
  if (term.length === 0) return []

  const templated = constructTemplateApplication(term)
  return templated ?? constructOrdinaryApplication(term)
}

/**
 * Parses source text into top-level Lisp forms.
 *
 * `parse` is intentionally literal: it tokenizes comments and parentheses,
 * turns numeric atoms into numbers, and returns the top-level forms exactly as
 * arrays, numbers, and symbols. A single term is therefore returned as a
 * one-form program, while definitions and a final expression are returned as
 * several forms. Semantic rewriting belongs to `encode`.
 *
 * Returns the thrown error after logging it, to preserve the current parser
 * contract used by the tests.
 *
 * @param {string} source
 * @returns {SourceForm[]|Error}
 */
export const parse = source => {
  try {
    return readSourceForms(source)
  }
  catch (error) {
    console.error(error)
    return error
  }
}

/**
 * Encodes parsed source forms as one Lisp-facing folding term.
 *
 * `encode` is the semantic Lisp step: definitions, aliases, `defn` parameter
 * templates, n-ary applications, staged folds, and source self-applications are
 * rewritten to the folding projection shown by `serialize`. Dense numeric
 * template applications, such as the staged S form, can be passed to
 * `construct` to recover the shared graph. Some source-level projections omit
 * passive closure identity by design, so `compile` materializes from the
 * semantic encoding directly when the full graph is required.
 *
 * Unlike `parse` and `compile`, this helper is not a text-input boundary; it
 * throws encoding errors directly so callers can decide how to surface them.
 *
 * @param {SourceForm[]} forms
 * @returns {SourceForm}
 */
export const encode = forms => encodeProgram(forms)

/**
 * Constructs the graph consumed by `observe` from one folding-instruction term.
 *
 * `construct` is intentionally small. It knows arrays, numbers, and temporary
 * atoms; numeric pair shapes are read as folding instructions, and everything
 * else is materialized as ordinary pair structure. Program constructs such as
 * `def` and `defn` are handled by `encode`, not here.
 *
 * @param {SourceForm} term
 * @returns {*}
 */
export const construct = term =>
  materializeGraph(resolveStagedFolds(constructTerm(term)))

/**
 * Compiles a multi-form source program to the pair graph consumed by
 * `observe`.
 *
 * `compile` reads source text into plain arrays, numbers, and symbols, then
 * runs the same semantic encoder used by `encode` directly into graph
 * materialization. This keeps recursive knots and shared closure identity
 * intact even where the current serialized projection is not yet a complete
 * reconstruction format for every source-level function.
 *
 * Source programs may contain `(def name body)` aliases, numeric folding
 * definitions such as `(def S ((0 2) (1 2)))`, `(defn name (x ...) body)`
 * functions, and one final expression. Fully applied numeric templates and
 * parameter-only `defn` bodies encode through the same folding path: each slot
 * becomes one shared fixed-point closure carrying hidden fill-order metadata
 * for `serialize`. Named functions can be held as compiler-only staged folds
 * while encoding higher-order source expressions, but those placeholders are
 * materialized before this function returns. Template bodies
 * encode directly; other `defn` bodies still receive fixed-point locals, so
 * their arguments exist in the graph even when the body also contains ordinary
 * symbols. Partial or unresolved applications remain ordinary left-associated
 * pairs.
 *
 * When delayed source self-application would otherwise expand forever during
 * compilation, encoding records a recursive knot and materialization returns
 * it as a fixed-point pair so `observe` sees the loop. This is a graph rule,
 * not a Lisp-name rule: recursive-looking calls with ordinary heads compile as
 * ordinary applications, and state persists only when the resulting pair graph
 * keeps it on observer-visible paths.
 *
 * Returns the thrown error after logging it, matching `parse` and preserving
 * the test-facing API.
 *
 * @param {string} source
 * @returns {*|Error}
 */
export const compile = source => {
  try {
    return materializeProgram(readSourceForms(source))
  }
  catch (error) {
    console.error(error)
    return error
  }
}

// Serialization and Lisp-facing graph projection.
const uniqueByIdentity = values =>
  values.filter((value, index) => values.indexOf(value) === index)

const canonicalSerialize = (pair, slots = new Map()) => {
  if (isFixed(pair)) {
    if (!slots.has(pair)) slots.set(pair, slots.size)
    return String(slots.get(pair))
  }

  if (isList(pair)) {
    return serializeList(pair, node => canonicalSerialize(node, slots))
  }

  return String(pair)
}

const mergeCounts = (left, right) =>
  [...right].reduce((counts, [group, count]) =>
    new Map(counts).set(group, (counts.get(group) ?? 0) + count),
                    left)

const visibleFoldCounts = node => {
  const meta = argumentClosures.get(node)
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
    activeGroups.has(group)
    && counts.get(group) === totals.get(group)
    && !childFoldCounts(node).some(child =>
      child.get(group) === totals.get(group)))

const collectFoldClosures = (node, group) => {
  const meta = argumentClosures.get(node)
  if (meta?.group === group) return [node]
  if (!isPair(node) || isFixed(node)) return []
  return [...collectFoldClosures(node[0], group),
          ...collectFoldClosures(node[1], group)]
}

const atomBoundary = node => !isList(node)

const sharedContinuation = node =>
  isPair(node)
    && isPair(node[0])
    && isPair(node[1])
    && node[0][1] === node[1][1]

const activeFoldGroups = (node, blocked = false) => {
  const meta = argumentClosures.get(node)
  const groups = meta && !blocked ? [meta.group] : []
  if (!isPair(node) || isFixed(node)) return new Set(groups)

  const sharedGroups = !blocked && sharedContinuation(node)
    ? visibleFoldCounts(node[0][1]).keys()
    : []

  return new Set([...groups,
                  ...sharedGroups,
                  ...activeFoldGroups(node[0], blocked),
                  ...activeFoldGroups(node[1],
                                      blocked || atomBoundary(node[0]))])
}

const serializeFilled = (pair, seen = []) => {
  if (seen.includes(pair)) return canonicalSerialize(pair)

  const meta = argumentClosures.get(pair)
  if (meta) return serializeFilled(meta.value, [...seen, pair])

  if (isList(pair)) {
    return serializeList(pair, node => serializeFilled(node, [...seen, pair]))
  }

  return String(pair)
}

const serializeFoldTemplate = (pair, group, slots, activeGroups) => {
  const meta = argumentClosures.get(pair)
  if (meta?.group === group) return String(slots.get(pair))
  if (meta) {
    return activeGroups.has(meta.group)
      ? serializeProjected(pair, visibleFoldCounts(pair), activeGroups)
      : serializeFilled(meta.value)
  }
  if (isFixed(pair)) return canonicalSerialize(pair)

  if (isList(pair)) {
    return serializeList(pair, node =>
      serializeFoldTemplate(node, group, slots, activeGroups))
  }

  return String(pair)
}

const serializeFold = (pair, group, activeGroups) => {
  const closures = uniqueByIdentity(collectFoldClosures(pair, group))
    .sort((left, right) =>
      argumentClosures.get(left).slot - argumentClosures.get(right).slot)
  const slots = new Map(closures.map((closure, index) => [closure, index]))
  const template = serializeFoldTemplate(pair, group, slots, activeGroups)
  const args = closures.map(closure =>
    serialize(argumentClosures.get(closure).value))

  return applySerializedArgs(template, args)
}

const serializeProjected = (
  pair,
  totals = visibleFoldCounts(pair),
  activeGroups = activeFoldGroups(pair)
) => {
  const meta = argumentClosures.get(pair)
  if (meta && !activeGroups.has(meta.group)) return serializeFilled(meta.value)

  const counts = visibleFoldCounts(pair)
  const group = foldBoundaryGroup(pair, totals, counts, activeGroups)
  if (group) return serializeFold(pair, group, activeGroups)
  if (isFixed(pair)) return canonicalSerialize(pair)

  if (isList(pair)) {
    return serializeList(pair, node =>
      serializeProjected(node, totals, activeGroups))
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
 * The numeric atoms in this projection always name fixed pairs. In a folding
 * instruction they are ordered slots from one compiler-created closure group;
 * outside such a group they are traversal-local labels for raw fixed pairs.
 * This keeps the notation graph-honest: both uses point at the same primitive
 * `[self, value]` shape, while their role is determined by projection context.
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
