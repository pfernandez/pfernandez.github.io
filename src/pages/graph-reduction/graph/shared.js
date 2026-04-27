export const isList = Array.isArray
export const isPair = node => isList(node) && node.length === 2
export const isFixed = node => isPair(node) && node[0] === node

const DELAYED_CALL = Symbol('delayed-call')
const ARGUMENT_SLOT = Symbol('argument-slot')

export const applyArgs = (head, args) =>
  args.reduce((left, right) => [left, right], head)

export const application = (expr, seen = new WeakSet()) => {
  if (!isList(expr) || expr.length === 0 || isFixed(expr) || seen.has(expr)) {
    return [expr, []]
  }

  seen.add(expr)
  const [head, ...rest] = expr
  const [base, args] = application(head, seen)
  return [base, [...args, ...rest]]
}

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
export const argumentSlotTemplate = (value, slot, group) => ({
  [ARGUMENT_SLOT]: true,
  group,
  slot,
  value
})

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
export const delayedCall = meta => ({
  [DELAYED_CALL]: true,
  ...meta
})

export const isDelayedCall = value =>
  Boolean(value) && typeof value === 'object' && value[DELAYED_CALL]

export const isArgumentSlotTemplate = value =>
  Boolean(value) && typeof value === 'object' && value[ARGUMENT_SLOT]

export const getDelayedCallMeta = value => value
export const getArgumentSlotMeta = value => value
