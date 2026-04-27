let ticks = 0

function trace(arr, path = '$', seen = new Map()) {
  if (!Array.isArray(arr)) return arr

  if (seen.has(arr)) {
    return `${seen.get(arr)}`
  }

  seen.set(arr, path)

  return arr.map((item, index) =>
    trace(item, `${path}[${index}]`, seen)
  )
}

/**
 * Performs one observation step.
 *
 * @param {unknown} focus
 * @returns {unknown}
 */
export const observe = focus => {
  console.log(JSON.stringify(trace(focus), null, 2))
  ticks++

  // Atoms are stable
  if (!Array.isArray(focus) || focus.length === 0) return focus

  const [first, rest] = focus

  // Pairs with atomic left children are stable
  if (!Array.isArray(first)) return focus

  // Pairs with fixed/empty left collapse to right identity
  if (first === focus || !first.length) return rest

  // Observe the next left child
  const nextFirst = observe(first)

  if (nextFirst !== first) {
    focus[0] = nextFirst
    return [nextFirst, rest]
  }

  // Observe right if left was stable
  const nextRest = observe(rest)
  if (nextRest !== rest) {
    focus[1] = nextRest
    return [first, nextRest]
  }

  // Both sides stable
  return focus
}

