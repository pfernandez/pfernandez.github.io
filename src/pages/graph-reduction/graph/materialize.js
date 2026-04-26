import {
  applyArgs,
  argumentSlotTemplates,
  delayedCalls,
  fixedClosure,
  isArgumentSlotTemplate,
  isDelayedCall,
  isPair
} from './shared.js'

const createMaterializerState = () => ({
  groups: [],
  slotsByGroup: new WeakMap(),
  crossings: []
})

const rememberSequenceSlot = (state, meta, node) => {
  let slots = state.slotsByGroup.get(meta.group)
  if (!slots) {
    slots = []
    state.slotsByGroup.set(meta.group, slots)
    state.groups.push(slots)
  }
  slots[meta.slot] = node
}

const sequenceFrom = state =>
  state.groups.flatMap(slots => slots.filter(Boolean))

const rememberCrossing = (state, node) => {
  if (!state.crossings.includes(node)) state.crossings.push(node)
}

const materializeDelayedCall = (value, seen, state, resolveValue) => {
  const meta = delayedCalls.get(value)
  return applyArgs(
    meta.name,
    meta.args.map(arg => materializeNode(arg, seen, state, resolveValue))
  )
}

const materializeArgumentSlot = (value, seen, state, resolveValue) => {
  const meta = argumentSlotTemplates.get(value)
  const resolvedValue = resolveValue(meta.value)

  if (isArgumentSlotTemplate(resolvedValue)) {
    const existing = materializeNode(resolvedValue, seen, state, resolveValue)
    seen.set(value, existing)
    return existing
  }

  const next = fixedClosure(null)
  seen.set(value, next)
  next[1] = materializeNode(resolvedValue, seen, state, resolveValue)
  rememberSequenceSlot(state, meta, next)
  return next
}

const materializePair = (value, seen, state, resolveValue) => {
  const next = [null, null]
  seen.set(value, next)
  next[0] = materializeNode(value[0], seen, state, resolveValue)
  next[1] = materializeNode(value[1], seen, state, resolveValue)
  return next
}

const materializeNode = (value, seen, state, resolveValue) => {
  const existing = seen.get(value)
  if (existing) {
    if (isPair(value) && value[0] !== value) rememberCrossing(state, existing)
    return existing
  }
  if (isDelayedCall(value)) {
    return materializeDelayedCall(value, seen, state, resolveValue)
  }
  if (isArgumentSlotTemplate(value)) {
    return materializeArgumentSlot(value, seen, state, resolveValue)
  }
  if (!isPair(value)) return value

  return materializePair(value, seen, state, resolveValue)
}

/**
 * Turns encoder-only placeholders into the plain pair graph used by observe.
 *
 * The returned `sequence` is the ordered argument path needed by serialize.
 * The returned `crossings` names graph points that participate in the same
 * sequence through shared identity, recurrence, or another lattice dimension.
 *
 * @param {*} value
 * @param {function(*): *} [resolveValue]
 * @returns {{graph: *, sequence: *[], crossings: *[]}}
 */
export const materialize = (value, resolveValue = node => node) => {
  const state = createMaterializerState()
  const graph = materializeNode(value, new WeakMap(), state, resolveValue)
  return { graph, sequence: sequenceFrom(state), crossings: state.crossings }
}
