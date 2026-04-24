export const isList = Array.isArray
export const isPair = node => isList(node) && node.length === 2
export const isFixed = node => isPair(node) && node[0] === node

export const argumentSlotTemplates = new WeakMap()
export const delayedCalls = new WeakMap()

export const applyArgs = (head, args) =>
  args.reduce((left, right) => [left, right], head)

export const serializeList = (pair, serializeChild) => {
  if (pair.length === 0) return '()'
  if (pair.length !== 2) throw new Error('Lists must be empty or pairs')
  return `(${serializeChild(pair[0])} ${serializeChild(pair[1])})`
}

export const fixedClosure = value => {
  const pair = []
  pair[0] = pair
  pair[1] = value
  return pair
}

// Temporary encoder object: materialize turns this into a fixed graph point.
export const argumentSlotTemplate = (value, slot, group) => {
  const template = {}
  argumentSlotTemplates.set(template, { group, slot, value })
  return template
}

export const cycleTemplate = () => {
  const template = []
  template[0] = template
  return template
}

export const withCycleBody = (template, body) => {
  template[1] = body
  return template
}

// Temporary encoder object: a named call waiting for enough arguments.
export const delayedCall = meta => {
  const value = {}
  delayedCalls.set(value, meta)
  return value
}

export const isDelayedCall = value =>
  Boolean(value) && typeof value === 'object' && delayedCalls.has(value)

export const isArgumentSlotTemplate = value =>
  Boolean(value)
  && typeof value === 'object'
  && argumentSlotTemplates.has(value)
