import {
  applyArgs,
  argumentSlotTemplate,
  argumentSlotTemplates,
  cycleTemplate,
  delayedCall,
  delayedCalls,
  isArgumentSlotTemplate,
  isDelayedCall,
  isFixed,
  isList,
  isPair,
  withCycleBody
} from './shared.js'
import { materialize } from './materialize.js'
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
 * Metadata for one argument slot before graph materialization.
 *
 * @typedef {{
 *   group: object,
 *   slot: number,
 *   value: *
 * }} ArgumentSlotTemplate
 */

/**
 * A source-level call waiting for enough arguments to be inlined.
 *
 * @typedef {{
 *   name: string,
 *   template?: SourceForm,
 *   entry?: ProgramEntry,
 *   env?: Map<string, ProgramEntry>,
 *   stack?: string[],
 *   arity: number,
 *   args: *[]
 * }} DelayedCall
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

// Source encoding.
export const application = expr => {
  if (!isList(expr) || expr.length === 0) return [expr, []]

  const [head, ...rest] = expr
  const [base, args] = application(head)
  return [base, [...args, ...rest]]
}

const collectSlotIndexes = (node, seen = new WeakSet()) => {
  if (isList(node)) {
    if (seen.has(node)) return null
    seen.add(node)
    if (node.length === 0) return null
    if (node.length !== 2) return null
    const left = collectSlotIndexes(node[0], seen)
    const right = collectSlotIndexes(node[1], seen)
    return left && right ? [...left, ...right] : null
  }
  if (typeof node !== 'number') return []
  if (!Number.isInteger(node) || node < 0) {
    throw new Error('Slot templates must use non-negative integer slots')
  }
  return [node]
}

const slotProfile = (template, arity = null) => {
  const indexes = collectSlotIndexes(template)
  if (!indexes || indexes.length === 0) return null

  const slots = [...new Set(indexes)].sort((a, b) => a - b)
  const sparse = slots.some((slot, index) => slot !== index)
  if (arity === null && sparse) {
    throw new Error('Slot templates must use dense slots from 0')
  }

  return { arity: arity ?? slots.length }
}

export const templateArity = template => slotProfile(template)?.arity ?? null
export const templateSlotCount = template => collectSlotIndexes(template)?.length ?? 0

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
    isList(node)
      ? node.length === 0
        ? []
        : [fill(node[0]), fill(node[1])]
      : typeof node === 'number'
        ? slots[node]
        : node
  const body = fill(template)
  const rest = args.slice(profile.arity).map(encodeArg)

  return applyArgs(body, rest)
}

const fillNumericTemplate = (template, args, arity) =>
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

const delayedCallForDefinition = (name, entry, env, stack) => {
  const template = templateForDefinition(entry)
  if (template) return delayedCall({ name, ...template, args: [] })

  return entry.kind === 'defn' && entry.params.length
    ? delayedCall({
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

const applyDelayedArgs = (head, args) =>
  args.reduce(applyDelayedCall, head)

const encodeExpression = (expr, env, locals = new Map(), stack = []) => {
  if (!isList(expr)) {
    if (typeof expr !== 'string') return expr

    if (locals.has(expr)) return locals.get(expr)

    const resolved = resolveDefinition(expr, env, stack)
    if (!resolved) return expr

    const { name, entry } = resolved
    const call = delayedCallForDefinition(name, entry, env, stack)
    if (call) return call

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
  if (isDelayedCall(encodedHead)) {
    return applyDelayedArgs(encodedHead, encodedArgs)
  }

  return encodeTemplateApplication(encodedHead, args, encodeArg)
    ?? applyArgs(encodedHead, encodedArgs)
}

// Delayed call application and recursive knots.
const applyDelayedCall = (value, arg) => {
  const meta = delayedCalls.get(value)
  const next = { ...meta, args: [...meta.args, arg] }

  if (next.args.length < next.arity) return delayedCall(next)

  if (Object.hasOwn(next, 'template')) {
    return fillNumericTemplate(next.template, next.args, next.arity)
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

const delayedCallHead = (value, seen = new WeakSet()) => {
  if (isDelayedCall(value)) return value
  if (isArgumentSlotTemplate(value)) {
    return delayedCallHead(argumentSlotTemplates.get(value).value, seen)
  }
  if (!isFixed(value) || seen.has(value)) return null
  seen.add(value)
  return delayedCallHead(value[1], seen)
}

const recursiveDelayedCall = (head, applications) => {
  const existing = applications.get(head)
  if (existing) return existing

  const loop = cycleTemplate()
  applications.set(head, loop)
  return withCycleBody(
    loop,
    resolveDelayedCalls(applyDelayedCall(head, loop), applications)
  )
}

export const resolveDelayedCalls = (value, applications = new WeakMap()) => {
  if (!isPair(value) || isFixed(value)) return value

  const left = resolveDelayedCalls(value[0], applications)
  const head = delayedCallHead(left)
  if (head) {
    if (left === value[1]) return recursiveDelayedCall(head, applications)
    return resolveDelayedCalls(applyDelayedCall(head, value[1]), applications)
  }

  const right = resolveDelayedCalls(value[1], applications)
  return left === value[0] && right === value[1] ? value : [left, right]
}

const materializeProgram = forms => {
  if (!forms.length) return []

  const { env, expr } = indexProgram(forms)
  const encoded = encodeExpression(expr, env)
  const resolved = resolveDelayedCalls(encoded)
  return materialize(resolved, resolveDelayedCalls)
}

const encodePlainExpression = expr => {
  if (!isList(expr)) return expr
  if (expr.length === 0) return []

  const [head, ...args] = expr
  return applyArgs(encodePlainExpression(head), args.map(encodePlainExpression))
}

const encodeProgramProjection = forms =>
  {
    const { graph, sequence } = materializeProgram(forms)
    return compactSlots(project(graph, sequence))
  }

const collectNumericSlots = (node, slots = new Set()) => {
  if (typeof node === 'number') slots.add(node)
  if (isPair(node)) {
    collectNumericSlots(node[0], slots)
    collectNumericSlots(node[1], slots)
  }
  return slots
}

const remapSlots = (node, slots) => {
  if (typeof node === 'number') return slots.get(node)
  if (isPair(node)) {
    return [remapSlots(node[0], slots), remapSlots(node[1], slots)]
  }
  return node
}

const compactSlots = node => {
  if (!isPair(node)) return node

  const values = [...collectNumericSlots(node)].sort((a, b) => a - b)
  if (values.every((value, index) => value === index)) return node

  const slots = new Map(values.map((value, index) => [value, index]))
  return remapSlots(node, slots)
}

const encodeProgram = forms =>
  !forms.length
    ? []
    : forms.length === 1 && !isDefinitionForm(forms[0])
      ? encodePlainExpression(forms[0])
      : encodeProgramProjection(forms)

/**
 * Encodes parsed source forms as one Lisp-facing term.
 *
 * `encode` rewrites definitions, aliases, function parameters, and n-ary calls
 * into the numeric template form understood by `construct`. For multi-form
 * programs it returns the same projection that `serialize` prints, but as
 * arrays and numbers instead of a parenthesized string.
 *
 * Unlike `parse` and `compile`, this helper is not a text-input boundary; it
 * throws encoding errors directly so callers can decide how to surface them.
 *
 * @param {SourceForm[]} forms
 * @returns {SourceForm}
 */
export const encode = forms => encodeProgram(forms)
