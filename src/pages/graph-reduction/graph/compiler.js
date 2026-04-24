import {
  applyArgs,
  argumentClosures,
  argumentSlotTemplate,
  argumentSlotTemplates,
  cycleTemplate,
  fixedClosure,
  isArgumentSlotTemplate,
  isFixed,
  isList,
  isPair,
  isStagedFold,
  stagedFold,
  stagedFolds,
  withCycleBody
} from './shared.js'
import { readSourceForms } from './parse.js'
import { project } from './serialize.js'

/**
 * @typedef {import('./parse.js').SourceForm} SourceForm
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
export const application = expr => {
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

export const encodeTemplateApplication = (
  template,
  args,
  encodeArg,
  arity = null
) => {
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

const applyStagedFoldArgs = (head, args) =>
  args.reduce(applyStagedFold, head)

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
const applyStagedFold = (value, arg) => {
  const meta = stagedFolds.get(value)
  const next = { ...meta, args: [...meta.args, arg] }

  if (next.args.length < next.arity) return stagedFold(next)

  if (Object.hasOwn(next, 'template')) {
    return encodeFoldTemplate(next.template, next.args, next.arity)
  }

  const group = {}
  const locals = functionLocals(
    next.entry.params,
    next.args.slice(0, next.arity),
    (slotValue, slot) => argumentSlotTemplate(slotValue, slot, group)
  )
  const body = encodeExpression(
    next.entry.body,
    next.env,
    locals,
    [...next.stack, next.name]
  )
  return applyArgs(body, next.args.slice(next.arity))
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

export const resolveStagedFolds = (value, applications = new WeakMap()) => {
  if (!isPair(value) || isFixed(value)) return value

  const left = resolveStagedFolds(value[0], applications)
  const head = stagedFoldHead(left)
  if (head) {
    if (left === value[1]) return recursiveStagedFold(head, applications)
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

export const materializeGraph = (value, seen = new WeakMap()) => {
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

const encodePlainExpression = expr => {
  if (!isList(expr)) return expr
  if (expr.length === 0) return []

  const [head, ...args] = expr
  return applyArgs(encodePlainExpression(head), args.map(encodePlainExpression))
}

const encodeProgramProjection = forms =>
  project(materializeProgram(forms))

const encodeProgram = forms =>
  !forms.length
    ? []
    : forms.length === 1 && !isDefinitionForm(forms[0])
      ? encodePlainExpression(forms[0])
      : encodeProgramProjection(forms)

/**
 * Encodes parsed source forms as one Lisp-facing folding term.
 *
 * `encode` is the semantic Lisp step: definitions, aliases, `defn` parameter
 * templates, n-ary applications, staged folds, and source self-applications are
 * rewritten to the folding projection shown by `serialize`. Dense numeric
 * template applications, such as the staged S form, can be passed to
 * `construct` to recover the shared graph. Some source-level projections omit
 * passive closure identity by design, so `compile` materializes from the
 * semantic encoding directly when the full graph is required. For multi-form
 * programs, `encode` shares the same graph projection as `serialize`, but it
 * returns arrays and numbers instead of a parenthesized string.
 *
 * Unlike `parse` and `compile`, this helper is not a text-input boundary; it
 * throws encoding errors directly so callers can decide how to surface them.
 *
 * @param {SourceForm[]} forms
 * @returns {SourceForm}
 */
export const encode = forms => encodeProgram(forms)

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
