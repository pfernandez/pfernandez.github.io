/**
 * Materialize one recurrence from already connected target identities.
 *
 * The sides of `pair` name `self` and `make`. `self` means the current root;
 * an expression beginning with `make` constructs a pair. Every other
 * expression is the exact identity it returns. Functions must therefore be
 * connected to their arguments before they enter this walk. Reuse comes from
 * shared identities and explicit transition cycles, not relative selection.
 */
export const unfold = root => {
  const origin = root[1][0]
  const enter = root => {
    const [pair, current] = root
    const self = pair[0]
    const make = pair[1]
    const evaluate = expression => expression === self
      ? root
      : expression[0] === make
        ? [
            evaluate(expression[1][0]),
            evaluate(expression[1][1])
          ]
        : expression
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
