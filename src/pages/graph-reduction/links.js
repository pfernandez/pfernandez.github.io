/**
 * @module links
 *
 * Lower a pair expression into a minimal link machine.
 *
 * The persistent state is only:
 * - `root`: the current top value
 * - `links`: an array of binary links
 *
 * Each link slot holds only:
 * - `null`
 * - an atom
 * - a link index
 *
 * `#n` is surface notation only. During lowering, it resolves against the
 * current binder stack, where each `(() body)` link contributes one binder.
 */

const isEmpty = pair => Array.isArray(pair) && pair.length === 0
const isRef = atom => typeof atom === 'string' && /^#\d+$/.test(atom)

const resolve = (atom, stack) => {
  const depth = Number(atom.slice(1))
  const index = stack.length - 1 - depth

  if (index < 0) {
    throw new Error(`Out-of-scope link: ${atom}`)
  }

  return stack[index]
}

/**
 * Lower a pair expression into `[root, links]`.
 *
 * For pair inputs, the initial root is the first allocated link at index `0`.
 * After reduction, the current root may become `null`, an atom, or any link
 * index reachable from the original graph.
 *
 * @param {*} pair
 * @returns {[*, Array<[*, *]>]}
 */
export const build = pair => {
  const links = []
  const stack = []

  const read = pair => {
    if (isEmpty(pair)) return null
    if (!Array.isArray(pair)) return isRef(pair) ? resolve(pair, stack) : pair

    if (pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    const index = links.length
    links.push([null, null])

    const left = read(pair[0])
    let right

    if (isEmpty(pair[0])) {
      stack.push(index)
      right = read(pair[1])
      stack.pop()
    } else {
      right = read(pair[1])
    }

    links[index] = [left, right]
    return index
  }

  return [read(pair), links]
}
