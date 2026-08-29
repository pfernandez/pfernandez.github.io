import { isFixed, isOpen } from './pair.js'

const find = (node, bindings) =>
  bindings.find(([input]) => input === node)?.[1]

/**
 * Match definition inputs with arguments by shared identity and structure.
 * Repeated input identities require the corresponding argument to be shared.
 */
export const match = (input, args, parameters, bindings = []) => {
  const known = find(input, bindings)
  if (known) return known === args ? bindings : undefined

  let matched = parameters.has(input)
    ? [...bindings, [input, args]]
    : bindings
  if (isOpen(input) || isFixed(input)) return matched
  if (isOpen(args) || isFixed(args)) return

  if (parameters.has(input)
    && input[0] !== input
    && args[0] === args) return

  if (input[0] !== input) {
    matched = match(input[0], args[0], parameters, matched)
    if (!matched) return
  }
  if (input[1] !== input)
    matched = match(input[1], args[1], parameters, matched)
  return matched
}

/** Select the bindings that distinguish one recurring configuration. */
export const stateBindings = bindings => bindings.filter(([input]) =>
  isFixed(input) || input[0] === input)
