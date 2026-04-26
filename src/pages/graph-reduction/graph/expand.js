import { encodeTemplateApplication, slotProfile } from './template.js'
import { application, applyArgs, argumentSlotTemplate, argumentSlotTemplates,
         cycleTemplate, delayedCall, delayedCalls, isArgumentSlotTemplate,
         isDelayedCall, isFixed, isList, isPair, withCycleBody } from './shared.js'

const normalizeParamList = params => {
  if (!isList(params)) throw new Error('defn params must be a list')
  if (params.some(param => typeof param !== 'string'))
    throw new Error('defn params must be symbols')
  return params
}

const makeProgramEntry = (name, body) => ({ kind: 'def', name, body })

const makeProgramFunction = (name, params, body) =>
  ({ kind: 'defn', name, params, body })

export const isDefinitionForm = form =>
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
    if (form.length < 4)
      throw new Error('Each form must be (defn name (x ...) body)')
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

const slotLocals = params => new Map(params.map((param, index) => [param, index]))

const functionLocals = (params, args, fixedArg) =>
  new Map(params.map((param, index) => [param, fixedArg(args[index], index)]))

const fillNumericTemplate = (template, args, arity) =>
  encodeTemplateApplication(template, args, value => value, arity)

const templateForDefinition = entry => {
  if (entry.kind === 'def') {
    const profile = slotProfile(entry.body)
    return profile && { template: entry.body, arity: profile.arity }
  }
  if (entry.params.length === 0) return null
  const { node: template, pure } = paramTemplate(entry.body, slotLocals(entry.params))
  return pure && { template, arity: entry.params.length }
}

const delayedCallForDefinition = (name, entry, env, stack) => {
  const template = templateForDefinition(entry)
  if (template) return delayedCall({ name, ...template, args: [] })
  return entry.kind === 'defn' && entry.params.length
    ? delayedCall({ name, entry, env, stack, arity: entry.params.length, args: [] })
    : null
}

const resolveDefinition = (name, env, stack) => {
  const entry = env.get(name)
  if (!entry) return null
  if (stack.includes(name))
    throw new Error(`Recursive definitions are not supported: ${name}`)
  if (entry.kind === 'def'
    && typeof entry.body === 'string'
    && env.has(entry.body)) {
    return resolveDefinition(entry.body, env, [...stack, name])
  }
  return { name, entry }
}

const hasCompleteFunctionApplication = (resolved, args) =>
  resolved?.entry.kind === 'defn' && args.length >= resolved.entry.params.length

const expandFunctionApplication =
  (resolved, args, expandArg, env, locals, stack) => {
    const { entry } = resolved
    const { node: template, pure } = paramTemplate(entry.body,
                                                   slotLocals(entry.params))
    const templated = pure
      ? encodeTemplateApplication(
        template, args, expandArg, entry.params.length)
      : null

    if (templated) return templated

    const group = {}
    const nextLocals = new Map([
      ...locals,
      ...functionLocals(entry.params,
                        args.slice(0, entry.params.length),
                        (arg, slot) =>
                          argumentSlotTemplate(expandArg(arg), slot, group))
    ])

    const body = expandExpression(
      entry.body, env, nextLocals, [...stack, resolved.name])

    return applyArgs(body, args.slice(entry.params.length).map(expandArg))
  }

const applyDelayedArgs = (head, args) => args.reduce(applyDelayedCall, head)

const expandExpression = (expr, env, locals = new Map(), stack = []) => {
  if (!isList(expr)) {
    if (typeof expr !== 'string') return expr

    if (locals.has(expr)) return locals.get(expr)

    const resolved = resolveDefinition(expr, env, stack)
    if (!resolved) return expr

    const { name, entry } = resolved

    const call = delayedCallForDefinition(name, entry, env, stack)
    if (call) return call

    return expandExpression(entry.body, env, new Map(), [...stack, name])
  }

  if (expr.length === 0) return []

  const [head, args] = application(expr)
  const expandArg = arg => expandExpression(arg, env, locals, stack)
  const resolved = typeof head === 'string' && !locals.has(head)
    ? resolveDefinition(head, env, stack)
    : null

  if (hasCompleteFunctionApplication(resolved, args))
    return expandFunctionApplication(
      resolved, args, expandArg, env, locals, stack)


  const templated = resolved?.entry.kind === 'def'
    ? encodeTemplateApplication(resolved.entry.body, args, expandArg)
    : null

  if (templated) return templated

  const expandedHead = expandExpression(head, env, locals, stack)
  const expandedArgs = args.map(expandArg)

  if (isDelayedCall(expandedHead))
    return applyDelayedArgs(expandedHead, expandedArgs)

  return encodeTemplateApplication(expandedHead, args, expandArg)
    ?? applyArgs(expandedHead, expandedArgs)
}

const applyDelayedCall = (value, arg) => {
  const meta = delayedCalls.get(value)
  const next = { ...meta, args: [...meta.args, arg] }

  if (next.args.length < next.arity) return delayedCall(next)

  if (Object.hasOwn(next, 'template'))
    return fillNumericTemplate(next.template, next.args, next.arity)

  const group = {}
  const locals = functionLocals(
    next.entry.params,
    next.args.slice(0, next.arity),
    (slotValue, slot) => argumentSlotTemplate(slotValue, slot, group)
  )

  const body = expandExpression(
    next.entry.body, next.env, locals, [...next.stack, next.name])

  return applyArgs(body, next.args.slice(next.arity))
}

const delayedCallHead = (value, seen = new WeakSet()) => {
  if (isDelayedCall(value)) return value

  if (isArgumentSlotTemplate(value))
    return delayedCallHead(argumentSlotTemplates.get(value).value, seen)

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

/**
 * Expands parsed source forms into the constructible symbolic term.
 *
 * This phase owns source-level definitions, function application, delayed
 * calls, template placeholders, and live recursive continuations. It does not
 * materialize the term into observer graph state; `construct` owns that step.
 *
 * @param {import('./parse.js').SourceForm[]} forms
 * @returns {*}
 */
export const expand = forms => {
  if (!forms.length) return []
  const { env, expr } = indexProgram(forms)
  return resolveDelayedCalls(expandExpression(expr, env))
}
