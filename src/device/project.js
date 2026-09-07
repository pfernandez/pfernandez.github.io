const left = pair => pair[0]
const right = pair => pair[1]
const fixed = pair => left(pair) === pair && right(pair) === pair

/** Project one already-linked graph into its attached device capabilities. */
export const project = ({
  source,
  focus,
  legend
}) => {
  const active = new Set()
  const entry = pair => legend.get(pair)
  const symbol = pair => entry(pair)?.capability ?? entry(pair)?.name
  // Materialization encloses every device input in an anonymous left-fixed
  // pair. No ordinary sibling sequence receives this wrapper.
  const isCall = pair => !legend.has(right(pair))
    && left(right(pair)) === right(pair)

  const evaluate = pair => {
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

      return pair.map(evaluate)
    } finally {
      active.delete(pair)
    }
  }

  const invoke = pair => {
    const capability = entry(left(pair))?.capability
    const fn = capability ?? evaluate(left(pair))
    if (typeof fn !== 'function')
      throw new TypeError('Capability result is not callable')

    const argumentGraph = right(right(pair))
    const inputs = fn.raw ? [argumentGraph] : list(argumentGraph)
    const argument = inputs[0]
    if (!capability) return fn(...inputs.map(evaluate))

    return fn({
      argument,
      args: () => inputs,
      evaluate,
      legend,
      source,
      values: () => inputs.map(evaluate)
    })
  }

  // Each input is a frame's left observation. The last frame returns to itself.
  const list = frame => right(frame) === frame
    ? [left(frame)]
    : [left(frame), ...list(right(frame))]

  return evaluate(focus)
}
