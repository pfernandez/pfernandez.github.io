import { pathToFileURL } from 'url'

const DEBUG = true
const NONE = Symbol('none')

const trace = (focus, name, result = NONE) => {
  const _trace = (arr, path = '$', seen = new Map()) => {
    if (!Array.isArray(arr)) return arr
    if (seen.has(arr)) return `${seen.get(arr)}`
    seen.set(arr, path)
    return arr.map((item, index) => _trace(item, `${path}[${index}]`, seen))
  }
  console.log(
    name ? name + ' : ' : '........................',
    JSON.stringify(_trace(focus)),
    result !== NONE ? '\n  -> ' : '',
    result !== NONE ? JSON.stringify(_trace(result)) : '',
    '\n')
}

/**
 * Performs one observation step.
 *
 * @param {unknown} focus
 * @returns {unknown}
 */
// export const observe = focus => {

//   DEBUG && trace(focus)
//   if (!Array.isArray(focus) || !focus.length)
//     return focus

//   const [first, rest] = focus

//   if (first === focus || (Array.isArray(first) && !first.length))
//     return rest

//   const nextFirst = observe(first)
//   if (nextFirst !== first)
//     return nextFirst

// //   const nextRest = observe(rest)
// //   if (nextRest !== rest)
// //     return nextRest

//   return focus
// }
export const observe = (focus) => {
  const walk = pair => {
    DEBUG && trace(pair)

    if (!Array.isArray(pair) || !pair.length) return pair

    const [first, next] = pair

    if (first === focus || !first.length) return next

    return walk(first)
  }

  return walk(focus)
}

const loop = (observer, focus, limit = 100) => {
  if (limit === 0) return focus

  const next = observer(focus)
  if (next === focus) return focus

  return loop(observer, next, limit - 1)
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{ // ///////////////////////////////////////////////////////////////////////////
  // DO NOT REMOVE

  const I = [[], 'x']
  trace(I, 'I', observe(I))

  const $I = []
  $I[0] = $I
  $I[1] = 'x'
  trace($I, 'I (self-referential)', observe($I))

  const K = [[[], 'x'], 'y']
  trace(K, 'K', observe(K))

  const $K = []
  $K[0] = $K
  $K[1] = 'y'
  $K[0][0] = $K[0]
  $K[0][1] = 'x'
  trace($K, 'K (self-referential)', observe($K))

  // S from plain empty pairs distributes z to both branches. The final [] is
  // the terminator: Replacing it with S creates an interesting cycle but does
  // not appear to converge:
  // [[[["$",[["x","z"],["y","z"]]],"x"],"y"],"z"]
  // [[[["$","z"],[["x","z"],["y","z"]]],"x"],"y"]
  // [[[["$","y"],"z"],[["x","z"],["y","z"]]],"x"]
  // [[[["$","x"],"y"],"z"],[["x","z"],["y","z"]]]
  // [[[["$",[["x","z"],["y","z"]]],"x"],"y"],"z"]
  const S = [[[[], 'x'], 'y'],  'z']
    S[0][0][0] = [[], [[S[0][0][1], S[1]], [S[0][1], S[1]]]]
  trace(S, 'S', observe(S))

//   // S in three steps acutally expands to this before beginning to converge.
//   // [[[[[[[[],[[],[[],[["x","z"],["y","z"]]]]],"x"],"y"],"z"],"x"],"y"],"z"]
//   const S3 = [[[[], 'x'], 'y'],  'z']
//   S3[0][0][0] = [[[[[], [[], [[], [[S[0][0][1], S[1]], [S[0][1], S[1]]]]]],
//          'x'], 'y'], 'z']
//   trace(S3, 'S (3 steps)', loop(observe, S3))

  // S with self-referential root. Replacing the terminator with $S produces the
  // exact cycle as with S.
  const $S = []
  $S[0] = [[$S, 'x'], 'y']
  $S[1] = 'z'
  $S[0][0][0] = [$S, [[$S[0][0][1], $S[1]], [$S[0][1], S[1]]]]
  trace($S, 'S (self-referential)', observe($S))

  // Z carries x forever by putting the cycle in the first slot of a delayed
  // pair.

  const Z = [[], 'x']
  Z[0][0] = []
  Z[0][1] = Z
  const Z_1 = observe(Z)
  const Z_2 = observe(Z_1)
  const Z_3 = observe(Z_2)
  trace(Z, 'Z', Z_1)
  trace(Z_1, 'Z 2', Z_2)
  trace(Z_2, 'Z 3', Z_3)


  const $Z = []
  $Z[0] = []
  $Z[1] = 'x'
  $Z[0][0] = $Z
  $Z[0][1] = $Z
  const $Z_1 = observe($Z)
  const $Z_2 = observe($Z_1)
  const $Z_3 = observe($Z_2)
  trace($Z, '$Z', $Z_1)
  trace($Z_1, '$Z 2', $Z_2)
  trace($Z_2, '$Z 3', $Z_3)



//   // Stream carries x forever by making the delayed cycle the rest of a parent
//   // that carries x.
//   const Stream = ['x', []]
//   Stream[1][0] = []
//   Stream[1][1] = Stream
//   const Stream_1 = observe(Stream)
//   const Stream_2 = observe(Stream_1)
//   const Stream_3 = observe(Stream_2)
//   trace(Stream, 'Stream', Stream_1)
//   trace(Stream_1, 'Stream 2', Stream_2)
//   trace(Stream_2, 'Stream 3', Stream_3)

//   //
// } // ///////////////////////////////////////////////////////////////////////////

// /**
//  * Convert a Dyck word (grammar `D := '(' D ')' D | ε`) into a full-binary tree
//  * form rendered as `(${left}${right})` with leaf `()`.
//  *
//  * @param {string} word
//  * @returns {string}
//  */
// const dyckToPairs = word => {
//   const parse = index => {
//     if (index >= word.length || word[index] === ')') return ['()', index]

//     const [left, closeIndex] = parse(index + 1)
//     const [right, nextIndex] = parse(closeIndex + 1)

//     return [`(${left}${right})`, nextIndex]
//   }

//   const [form] = parse(0)
//   return form
// }

// /**
//  * Enumerate Dyck words of semilength `n` in a deterministic backtracking order.
//  *
//  * @param {number} n
//  * @returns {string[]}
//  */
// export const dyck = n => {
//   const build = (word = '', opens = 0, closes = 0) => {
//     if (word.length === 2 * n) return [word]

//     const wordsWithOpen = opens < n
//       ? build(`${word}(`, opens + 1, closes)
//       : []

//     const wordsWithClose = closes < opens
//       ? build(`${word})`, opens, closes + 1)
//       : []

//     return [...wordsWithOpen, ...wordsWithClose]
//   }

//   return build()
}

/**
 * Enumerate Catalan trees (full binary trees) of size `n` by mapping each Dyck
 * word through the canonical `D := '(' D ')' D | ε` parse.
 *
 * This ensures the enumeration order matches `dyck(n)` under the bijection.
 *
 * @param {number} n
 * @returns {string[]}
 */
const pairs = n => dyck(n).map(dyckToPairs)
