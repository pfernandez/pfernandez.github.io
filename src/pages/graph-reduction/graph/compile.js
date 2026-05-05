import { parse } from './parse.js'

const isList = v => Array.isArray(v)
const lookup = (env, name) => env.findLast(e => e.name === name)

const resolveAlias = (term, env, seen = []) => {
  if (typeof term !== 'string') return term
  if (seen.includes(term)) throw new Error(`cyclic alias: ${[...seen, term].join(' -> ')}`)
  const entry = lookup(env, term)
  return entry?.alias ? resolveAlias(entry.alias, env, [...seen, term]) : term
}

const applicationOf = term => {
  if (!isList(term) || !term.length) return { head: term, args: [] }
  const prefix = applicationOf(term[0])
  return { head: prefix.head, args: [...prefix.args, ...term.slice(1)] }
}

const applyArgs = (head, args) => args.reduce((l, r) => [l, r], head)

const carryForever = v => {
  const g = [[], v]
  g[0] = [[], g]
  return g
}

const connectTerm = (term, env, bindings = [], active = []) => {
  if (typeof term === 'string') {
    const b = bindings.findLast(b => b.name === term)
    if (b) return b.value
    const r = resolveAlias(term, env)
    return r === term ? term : connectTerm(r, env, bindings, active)
  }
  if (!isList(term) || !term.length) return []

  const { head, args } = applicationOf(term)
  const cHead = connectTerm(head, env, bindings, active)
  const cArgs = args.map(a => connectTerm(a, env, bindings, active))
  const connected = applyArgs(cHead, cArgs)

  const app = applicationOf(connected)
  const entry = lookup(env, resolveAlias(app.head, env))

  return entry?.params && app.args.length >= entry.params.length
    ? connectDef(entry, app.args, env, active)
    : connected
}

export const reduceDefinition = ([params, body], args, env = [], active = []) => {
  const bindings = params.map((name, i) => ({ name, value: args[i] }))
  return [[], connectTerm(body, env, bindings, active)]
}

const isDirectSelf = e => {
  if (!isList(e.body)) return false
  const app = applicationOf(e.body)
  return app.head === e.name && app.args.length === e.params.length
    && app.args.every((a, i) => a === e.params[i])
}

const isFixedPoint = e => {
  if (e.params?.length !== 1 || !isList(e.body) || e.body.length !== 2) return false
  const [l, r] = e.body
  return JSON.stringify(l) === JSON.stringify(r) && JSON.stringify(l).includes(JSON.stringify(e.params[0]))
}

const getPayload = (e, args, env) => {
  if (!isFixedPoint(e) || args.length !== 1) return
  const t = lookup(env, resolveAlias(args[0], env))
  if (!t || t.params?.length !== 1 || !isList(t.body)) return
  const app = applicationOf(t.body)
  return app.head === t.params[0] && app.args.length === 1 ? connectTerm(app.args[0], env) : undefined
}

const connectDef = (e, args, env, active) => {
  const callArgs = args.slice(0, e.params.length)
  if (active.some(f => f.name === e.name && f.args.length === callArgs.length && f.args.every((a, i) => a === callArgs[i]))) {
    return isDirectSelf(e) ? carryForever(callArgs.reduce((l, r) => [l, r])) : applyArgs(e.name, callArgs)
  }
  const payload = getPayload(e, args, env)
  if (payload) return carryForever(payload)

  return reduceDefinition(
    [e.params, applyArgs(e.body, args.slice(e.params.length))],
    callArgs, env, [...active, { name: e.name, args: callArgs }]
  )
}

export const compile = source => {
  try {
    const env = [], forms = parse(source)
    let expression = []
    for (const f of forms) {
      if (isList(f) && f[0] === 'defn') env.push({ name: f[1], params: f[2], body: f[3] })
      else if (isList(f) && f[0] === 'def') env.push({ name: f[1], alias: f[2] })
      else expression = f
    }
    return { graph: connectTerm(expression, env) }
  } catch (e) { return { error: e.message } }
}
