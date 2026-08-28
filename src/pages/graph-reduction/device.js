import { link } from './graph/index.js'

const left = pair => pair[0]
const right = pair => pair[1]
const fixed = pair => left(pair) === pair && right(pair) === pair

export const view = (program, functions) => {
  const { source, focus, result, legend, error } = link(program, functions)
  if (error) throw error
  const active = new Set()
  const entry = pair => legend.get(pair)
  const symbol = pair => entry(pair)?.capability ?? entry(pair)?.name
  const isCall = pair => typeof entry(left(pair))?.capability === 'function'

  const evaluate = pair => {
    // External views currently replace a recurring identity with its name;
    // another adapter could instead preserve the shared reference.
    if (active.has(pair)) return symbol(pair)
    active.add(pair)

    try {
      if (legend.has(pair)) {
        if (fixed(pair)) return symbol(pair)

        return [symbol(pair), isCall(pair)
          ? invoke(pair)
          : evaluate(right(pair))]
      }

      return isCall(pair) ? invoke(pair) : pair.map(evaluate)
    } finally {
      active.delete(pair)
    }
  }

  const invoke = pair => {
    const fn = entry(left(pair))?.capability
    const argument = right(pair)
    return fn({
      argument,
      args: (node = argument) => list(node),
      evaluate,
      legend,
      source,
      values: (node = argument) => list(node).map(evaluate)
    })
  }

  const list = pair =>
    legend.has(pair) || isCall(pair)
      ? [pair]
      : [left(pair), ...list(right(pair))]

  // The source-selected result is the host entrypoint when one is exposed;
  // otherwise the host begins at the complete final focus.
  return evaluate(result ?? focus)
}
