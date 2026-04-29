const DEBUG = true

const trace = (focus, name, result) => {
  const _trace = (arr, path = '$', seen = new Map()) => {
    if (!Array.isArray(arr)) return arr
    if (seen.has(arr)) return `${seen.get(arr)}`
    seen.set(arr, path)
    return arr.map((item, index) => _trace(item, `${path}[${index}]`, seen))
  }
  console.log(
    '\n',
    name ? name + ' : ' : '',
    _trace(focus),
    result ? ' -> ' : '',
    result ? _trace(result) : '',
    '\n')
}

/**
 * Performs one observation step.
 *
 * @param {unknown} focus
 * @returns {unknown}
 */
export const observe = focus => {
  DEBUG && trace(focus, 1)

  // Atoms are stable
  if (!Array.isArray(focus) || focus.length === 0) return focus

  DEBUG && trace(focus, 2)

  const [first, rest] = focus

  // Pairs with atomic left children are stable
  if (!Array.isArray(first)) return focus

  DEBUG && trace(focus, 3)

  // Pairs with fixed/empty left collapse to right identity
  if (first === focus || !first.length) return rest

  DEBUG && trace(focus, 4)

  // Observe the next left child
  const nextFirst = observe(first)

  if (nextFirst !== first) {

    DEBUG && trace(focus, 5)

    // focus[1] = nextFirst; return focus  // mutation
    // return [nextFirst, rest]           // replacement
    return nextFirst                    // unchanged
  }

  // Observe right if left was stable
  const nextRest = observe(rest)
  if (nextRest !== rest) {

    DEBUG && trace(focus, 6)

    // focus[1] = nextRest; return focus  // mutation
    // return [first, nextRest]           // replacement
    return nextRest                    // unchanged
  }

  DEBUG && trace(focus, 7)

  // Both sides stable
  return focus
}

// /////////////////////////////////////////////////////////////////////////////
// DO NOT REMOVE


// (() x) -> x

let I = []
I[0] = I
I[1] = 'x'

trace(I, 'I', observe(I))


// ((() x) y) -> x

I = []

I[0] = I
I[1] = 'y'
I[0][0] = I
I[0][1] = 'x'

trace(I, 'K', observe(I))


// (((((x z) (y z)) x) y) z) -> ((x z) (y z))

I = []

I[0] = I
I[1] = 'z'

I[0][0] = I
I[0][1] = 'y'

I[0][0][0] = I
I[0][0][1] = 'x'

I[0][0][0][0] = I
I[0][0][0][1] = I

I[0][0][0][0][0] = I[0][0][1]  // x
I[0][0][0][0][1] = I[1]        // z

I[0][0][0][1][0] = I[0][1]     // y
I[0][0][0][1][1] = I[1]        // z

trace(I, 'S', observe(I))

//
// /////////////////////////////////////////////////////////////////////////////
