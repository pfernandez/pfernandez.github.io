import { functions } from './functions.js'
import { link } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const isCall = pair => typeof left(pair)?.symbol === 'function'
const fixed = pair => left(pair) === pair && right(pair) === pair

export const view = source => {
  const { focus, error } = link(source, functions)
  if (error) throw error
  const active = new Set()

  const evaluate = pair => {
    if (active.has(pair)) return pair.symbol
    active.add(pair)

    try {
      if ('symbol' in pair) {
        if (fixed(pair)) return pair.symbol

        if (typeof pair.symbol === 'string' && pair.symbol.startsWith('on'))
          return [pair.symbol, () => evaluate(right(pair))]

        return [pair.symbol, isCall(pair)
          ? invoke(pair)
          : evaluate(right(pair))]
      }

      return isCall(pair) ? invoke(pair) : pair.map(evaluate)
    } finally {
      active.delete(pair)
    }
  }

  const invoke = pair => {
    const fn = left(pair)?.symbol
    const argument = right(pair)
    return fn({
      argument,
      evaluate,
      source,
      values: (node = argument) => args(node).map(evaluate)
    })
  }

  const args = pair =>
    'symbol' in pair || isCall(pair)
      ? [pair]
      : [left(pair), ...args(right(pair))]

  return evaluate(focus)
}
