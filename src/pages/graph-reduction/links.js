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

/**
 * Lower a pair expression into `[root, links]`.
 *
 * For pair inputs, the initial root is the first allocated link at index `0`.
 * After reduction, the current root may become `null`, an atom, or any link
 * index reachable from the original graph.
 *
 * @param {*} pair
 * @param {(ref: { from: string, to: number, toPath: string, depth: number }) => void} [onref]
 * @returns {[*, Array<[*, *]>]}
 */
export const build = (pair, onref = null) => {
  const links = []
  const stack = []

  const read = (pair, path = 'root') => {
    if (isEmpty(pair)) return null
    if (!Array.isArray(pair)) {
      if (!isRef(pair)) return pair

      const depth = Number(pair.slice(1))
      const frame = stack[stack.length - 1 - depth]
      if (!frame) throw new Error(`Out-of-scope link: ${pair}`)

      onref?.({ from: path,
                to: frame.index,
                toPath: `${frame.path}0`,
                depth })
      return frame.index
    }

    if (pair.length !== 2) {
      throw new Error('Lists must be empty or pairs')
    }

    const index = links.length
    links.push([null, null])

    const left = read(pair[0], `${path}0`)
    let right

    if (isEmpty(pair[0])) {
      stack.push({ index, path })
      right = read(pair[1], `${path}1`)
      stack.pop()
    } else {
      right = read(pair[1], `${path}1`)
    }

    links[index] = [left, right]
    return index
  }

  return [read(pair), links]
}
