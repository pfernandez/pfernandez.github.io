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
    if (typeof fn !== 'function') {
      if (typeof fn === 'string' && fn.startsWith('on')) {
        const continuation = right(pair)
        return [fn, () => evaluate(
          callable(continuation) ? continuation : right(continuation))]
      }

      return pair.map(evaluate)
    }

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
