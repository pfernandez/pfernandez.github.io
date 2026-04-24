export const isList = Array.isArray
export const isPair = node => isList(node) && node.length === 2
export const isFixed = node => isPair(node) && node[0] === node

export const argumentClosures = new WeakMap()
export const argumentSlotTemplates = new WeakMap()
export const stagedFolds = new WeakMap()

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

export const stagedFold = meta => {
  const value = {}
  stagedFolds.set(value, meta)
  return value
}

export const isStagedFold = value =>
  Boolean(value) && typeof value === 'object' && stagedFolds.has(value)

export const isArgumentSlotTemplate = value =>
  Boolean(value)
  && typeof value === 'object'
  && argumentSlotTemplates.has(value)
