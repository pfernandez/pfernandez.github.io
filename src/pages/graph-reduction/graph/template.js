import { applyArgs, argumentSlotTemplate, isList } from './shared.js'

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
  if (!Number.isInteger(node) || node < 0)
    throw new Error('Slot templates must use non-negative integer slots')
  return [node]
}

export const slotProfile = (template, arity = null) => {
  const indexes = collectSlotIndexes(template)
  if (!indexes || indexes.length === 0) return null
  const slots = [...new Set(indexes)].sort((a, b) => a - b)
  const sparse = slots.some((slot, index) => slot !== index)
  if (arity === null && sparse)
    throw new Error('Slot templates must use dense slots from 0')
  return { arity: arity ?? slots.length }
}

export const templateArity = template => slotProfile(template)?.arity ?? null

export const templateSlotCount = template =>
  collectSlotIndexes(template)?.length ?? 0

export const encodeTemplateApplication = (template, args, encodeArg, arity = null) => {
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
