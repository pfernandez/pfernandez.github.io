const select = (state, path, left) =>
  path === left
    ? state
    : select(state[path[0] === left ? 0 : 1], path[1], left)

/**
 * Materialize one recurrence of `[pair, [function, argument]]` roots.
 *
 * `pair` names left, right, and pair construction by identity. A function is
 * two expressions, one for each side of its result. An expression is either
 * a path into the complete call or `[pair, [before, after]]`; the left
 * identity ends paths. Each root carries this language pair and its current
 * call. Each result is therefore both a fresh pair and the next call. An
 * excursion finishes when its function position returns to its origin.
 */
export const unfold = root => {
  const origin = root[1][0]
  const enter = root => {
    const [pair, current] = root
    const left = pair[0]
    const evaluate = expression =>
      expression[0] === pair
        ? [
            evaluate(expression[1][0]),
            evaluate(expression[1][1])
          ]
        : select(root, expression, left)
    const fn = current[0]
    const next = [
      evaluate(fn[0]),
      evaluate(fn[1])
    ]

    return next[1][0] === origin
      ? next
      : enter(next)
  }

  return enter(root)
}
