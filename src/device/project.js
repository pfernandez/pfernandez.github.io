const left = pair => pair[0]
const right = pair => pair[1]
const fixed = pair => left(pair) === pair && right(pair) === pair

/** Project one already-linked graph into its attached device capabilities. */
export const project = ({
  source,
  focus,
  result,
  results,
  selections,
  legend
}) => {
  const active = new Set()
  const entry = pair => legend.get(pair)
  const symbol = pair => entry(pair)?.capability ?? entry(pair)?.name
  const isCall = pair => typeof entry(left(pair))?.capability === 'function'

  const evaluate = pair => {
    // Construction remains in Root while its authored result crosses the
    // device boundary.
    const selected = !legend.has(pair)
      && (selections?.get(pair) ?? results?.get(pair))
    if (selected && selected !== pair) return evaluate(selected)

    // Device projection currently replaces a recurring identity with its name;
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

      if (isCall(pair)) return invoke(pair)

      if (isCall(left(pair))) {
        const returned = evaluate(left(pair))
        if (typeof returned !== 'function')
          throw new TypeError('Capability result is not callable')
        return returned(...list(right(pair)).map(evaluate))
      }

      return pair.map(evaluate)
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
    legend.has(pair) || isCall(pair) || results?.has(pair)
      ? [pair]
      : [left(pair), ...list(right(pair))]

  // The source-selected result is the host entrypoint when one is exposed;
  // otherwise the host begins at the complete final focus.
  return evaluate(result ?? focus)
}
