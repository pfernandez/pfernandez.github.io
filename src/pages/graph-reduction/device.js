import { functions } from './functions.js'
import { link } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const callable = pair => typeof left(pair)?.symbol === 'function'
const fixed = pair => left(pair) === pair && right(pair) === pair

export const view = source => {
  const linked = link(source, functions)
  if (linked.error) throw linked.error
  const active = new Set()

  const evaluate = pair => {
    if (active.has(pair)) return pair.symbol
    active.add(pair)

    try {
      if ('symbol' in pair) {
        if (fixed(pair)) return pair.symbol

        if (typeof pair.symbol === 'string' && pair.symbol.startsWith('on'))
          return [pair.symbol, () => evaluate(right(pair))]

        return [pair.symbol, callable(pair)
          ? evaluateCall(pair)
          : evaluate(right(pair))]
      }

      return evaluateCall(pair)
    } finally {
      active.delete(pair)
    }
  }

  const evaluateCall = pair => {
    const fn = left(pair)?.symbol
    if (typeof fn !== 'function') return pair.map(evaluate)

    const argument = right(pair)
    return fn({
      argument,
      evaluate,
      source,
      values: (node = argument) => args(node).map(evaluate)
    })
  }

  const args = pair =>
    'symbol' in pair || callable(pair)
      ? [pair]
      : [left(pair), ...args(right(pair))]

  return evaluate(linked.focus)
}
