const fixed = pair => pair[0] === pair && pair[1] === pair

const select = (state, path, left) =>
  fixed(path)
    ? state
    : select(state[path[0] === left ? 0 : 1], path[1], left)

/**
 * Materialize one recurrence of `[function, argument]` states.
 *
 * `language` names left and pair construction by identity. A function is two
 * expressions, one for each side of its result. An expression is either a
 * path into the complete call or `[pair, [before, after]]`; fixed identities
 * end paths. Each result is therefore both a fresh pair and the next call. An
 * excursion finishes when its function position returns to its origin.
 */
export const unfold = (language, state) => {
  const [left, pair] = language
  const evaluate = (expression, state) =>
    expression[0] === pair
      ? [
          evaluate(expression[1][0], state),
          evaluate(expression[1][1], state)
        ]
      : select(state, expression, left)
  const apply = current => {
    const fn = current[0]
    return [
      evaluate(fn[0], current),
      evaluate(fn[1], current)
    ]
  }
  const enter = (current, origin) => {
    const next = apply(current)
    return next[0] === origin ? next : enter(next, origin)
  }

  return enter(state, state[0])
}
