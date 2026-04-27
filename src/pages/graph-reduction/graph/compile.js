import { parse } from './parse.js'
import {
  applyArgs,
  fixedClosure,
  isList,
  isPair
} from './shared.js'

const SLOT = Symbol('slot')
const TRIGGER = Symbol('trigger')

const isSlot = x => x && typeof x === 'object' && x.kind === SLOT
const isTrigger = x => x && typeof x === 'object' && x.kind === TRIGGER

/**
 * Compiles source text into a pure pair graph (no redundant definition structure).
 */
export const compile = source => {
  try {
    const forms = parse(source)
    if (!forms.length) return { graph: [], sequence: [], crossings: [] }

    const { env, expression } = indexProgram(forms)
    const expanded = expand(expression, env)
    return materialize(expanded)
  }
  catch (error) {
    console.error(error)
    return { error: String(error) }
  }
}

const indexProgram = forms => {
  const env = new Map()
  let expression = []
  
  for (const form of forms) {
    if (isList(form) && (form[0] === 'def' || form[0] === 'defn')) {
      const [, name] = form
      env.set(name, form)
    } else {
      expression = form
    }
  }
  
  return { env, expression }
}

const expand = (expr, env, locals = new Map(), stack = []) => {
  if (typeof expr === 'string') {
    if (locals.has(expr)) return locals.get(expr)
    const entry = env.get(expr)
    if (!entry) return expr
    if (stack.includes(expr)) return expr
    
    if (entry[0] === 'def') {
      return expand(entry[2], env, locals, [...stack, expr])
    }
    
    return { kind: 'func', name: expr, params: entry[2], body: entry[3], args: [], env, stack: [...stack, expr] }
  }
  if (!isList(expr)) return expr
  if (expr.length === 0) return []
  
  const [head, ...args] = expr
  const expandedHead = expand(head, env, locals, stack)
  const expandedArgs = args.map(arg => expand(arg, env, locals, stack))
  
  return expandedArgs.reduce((acc, arg) => {
    if (acc && typeof acc === 'object' && acc.kind === 'func') {
      const nextArgs = [...acc.args, arg]
      if (nextArgs.length >= acc.params.length) {
        const fnParams = acc.params
        const fnBody = acc.body
        const group = {}
        const nextLocals = new Map(acc.locals)
        const slots = nextArgs.slice(0, fnParams.length).map((v, i) => ({ kind: SLOT, value: v, index: i, group }))
        fnParams.forEach((p, i) => nextLocals.set(p, slots[i]))
        
        const body = expand(fnBody, env, nextLocals, acc.stack)
        
        // Return a Trigger to keep the causal tick
        return { kind: TRIGGER, payload: applyArgs(body, nextArgs.slice(fnParams.length)) }
      }
      return { ...acc, args: nextArgs }
    }
    return [acc, arg]
  }, expandedHead)
}

const materialize = (term) => {
  const seen = new Map()
  const sequence = []
  const crossings = []
  
  const walk = (node) => {
    if (seen.has(node)) {
      const result = seen.get(node)
      if (isPair(result) && !crossings.includes(result)) {
        crossings.push(result)
      }
      return result
    }
    
    if (node && typeof node === 'object' && node.kind === TRIGGER) {
      const fixed = fixedClosure(null)
      seen.set(node, fixed)
      fixed[1] = walk(node.payload)
      return fixed
    }

    if (node && typeof node === 'object' && node.kind === SLOT) {
      const fixed = fixedClosure(null)
      seen.set(node, fixed)
      fixed[1] = walk(node.value)
      sequence.push(fixed)
      return fixed
    }
    
    if (node && typeof node === 'object' && node.kind === 'func') {
      const res = applyArgs(node.name, node.args.map(walk))
      seen.set(node, res)
      return res
    }
    
    if (!isPair(node)) return node
    
    const result = [null, null]
    seen.set(node, result)
    result[0] = walk(node[0])
    result[1] = walk(node[1])
    return result
  }
  
  const graph = walk(term)
  return { graph, sequence, crossings }
}
