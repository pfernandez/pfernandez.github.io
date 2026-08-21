import { functions } from './functions.js'
import { link } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const callable = pair => typeof left(pair)?.symbol === 'function'

export const view = source => {
  const linked = link(source, functions)
  if (linked.error) throw linked.error

  const evaluate = pair => {
    if ('symbol' in pair) return pair.symbol

    const fn = left(pair)?.symbol
    if (typeof fn !== 'function')
      throw new Error(`Unknown device identity: ${left(pair)?.symbol}`)

    const argument = right(pair)
    return fn({
      argument,
      evaluate,
      properties,
      source,
      values: (node = argument) => args(node)
    })
  }

  // An Elements call may carry a property tree as its first argument. Leaves
  // are `(name value)` entries; internal pairs collect entries without nil.
  const properties = pair => {
    if ('symbol' in pair || callable(pair)) return

    const entries = pair => {
      if ('symbol' in pair || callable(pair)) return
      if ('symbol' in left(pair)) {
        const name = left(pair).symbol
        return [[name, property(name, right(pair))]]
      }

      const before = entries(left(pair))
      const after = entries(right(pair))
      return before && after && [...before, ...after]
    }
    const property = (name, pair) => name?.startsWith('on')
      ? callable(pair)
        ? evaluate(pair)
        : () => evaluate(right(pair))
      : evaluate(pair)

    const found = entries(pair)
    return found && Object.fromEntries(found)
  }

  const args = pair =>
    'symbol' in pair || callable(pair)
      ? [evaluate(pair)]
      : [evaluate(left(pair)), ...args(right(pair))]

  return evaluate(linked.focus)
}
