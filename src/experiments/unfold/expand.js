/** Give every focus in a recurrent right orbit a direct transition function. */
export const expand = (pair, origin) => {
  const self = pair[0]
  const make = pair[1]
  const first = []
  const join = (before, after) => [make, [before, after]]

  const transition = (focus, fn = []) => {
    const next = focus[1]
    fn[0] = pair
    fn[1] = join(
      next === origin ? first : transition(next),
      join(self, next)
    )
    return fn
  }

  return [pair, [transition(origin, first), origin]]
}
