import { decompose } from '../../graph/index.js'

const isSymbol = value => typeof value === 'string'

/**
 * Give raw pair values shared identities by name.
 *
 * A name is visible within its value and every following form. A single value
 * fills its right side; two or more values fill both sides of its pair.
 */
export const assemble = tree => {
  const names = new Map()

  const resolve = expression => {
    if (!isSymbol(expression))
      return [resolve(expression[0]), resolve(expression[1])]

    const identity = names.get(expression)
    if (!identity) throw new ReferenceError(`Unknown identity: ${expression}`)
    return identity
  }

  const identify = form => {
    const [name, value] = decompose(form)
    const identity = []
    names.set(name, identity)

    if (isSymbol(value)) {
      identity[0] = identity
      identity[1] = resolve(value)
    } else {
      identity[0] = resolve(value[0])
      identity[1] = resolve(value[1])
    }
    return identity
  }

  const sequence = ([first, ...rest]) => rest.length
    ? [identify(first), sequence(rest)]
    : identify(first)

  return { graph: sequence(tree), names }
}
