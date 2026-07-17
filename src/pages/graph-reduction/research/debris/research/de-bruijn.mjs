import { pathToFileURL } from 'url'

const NONE = Symbol('none')

const trace = (focus, name, result = NONE, history = []) => {
  const _trace = (arr, path = '$', seen = new Map()) => {
    if (!Array.isArray(arr)) return arr
    if (seen.has(arr)) return `${seen.get(arr)}`
    seen.set(arr, path)
    return arr.map((item, index) => _trace(item, `${path}[${index}]`, seen))
  }
  console.log(
    '\n',
    name ? name + ' : ' : '',
    JSON.stringify(_trace(focus)),
    history.length ? ' history: ' : '',
    history.length ? JSON.stringify(_trace(history)) : '',
    result !== NONE ? '\n\n  -> ' : '',
    result !== NONE ? _trace(result) : '',
    '\n')
}

const instantiate = (term, history) => {
  if (!Array.isArray(term)) return history[term]
  return term.map(item => instantiate(item, history))
}

/**
 * Performs one observation step.
 *
 * The fixed node is a single self-reference. Its unfolded application spine is
 * represented by the observer's history stack.
 *
 * @param {unknown} focus
 * @param {unknown[]} history
 * @returns {unknown}
 */
export const observe = (focus, history = []) => {
  if (!Array.isArray(focus)) return focus

  const [first, rest] = focus

  if (first === focus) return instantiate(rest, history)
  return focus
}


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // /////////////////////////////////////////////////////////////////////////////
  // DO NOT REMOVE


  const I = []
  I[0] = I


  // I x -> x

  I[1] = 0

  trace(I, 'I', observe(I, ['x']), ['x'])


  // K x y -> x

  I[1] = 0

  trace(I, 'K', observe(I, ['x', 'y']), ['x', 'y'])


  // S x y z -> ((x z) (y z))

  I[1] = [[0, 2], [1, 2]]

  trace(I, 'S', observe(I, ['x', 'y', 'z']), ['x', 'y', 'z'])

  //
  // /////////////////////////////////////////////////////////////////////////////
}
