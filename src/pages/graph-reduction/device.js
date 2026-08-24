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
      args: (node = argument) => list(node),
      evaluate,
      source,
      values: (node = argument) => list(node).map(evaluate)
    })
  }

  const list = pair =>
    'symbol' in pair || isCall(pair)
      ? [pair]
      : [left(pair), ...list(right(pair))]

  return evaluate(focus)
}
