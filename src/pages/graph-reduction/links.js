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
const isLink = value => Array.isArray(value) && value.length === 2

const read = (value, links) => {
  let current = value

  while (typeof current === 'number') {
    const next = links[current]
    if (isLink(next)) return current
    current = next
  }

  return current
}

const id = (value, links) => {
  let current = value
  let link = null

  while (typeof current === 'number') {
    link = current
    const next = links[current]
    if (isLink(next)) return `link:${current}`
    current = next
  }

  return link === null ? null : `link:${link}`
}

const find = (value, links, path = 'root') => {
  const app = read(value, links)
  if (typeof app !== 'number') return null

  const [left, right] = links[app]
  const binder = read(left, links)

  if (typeof binder === 'number') {
    const [head, body] = links[binder]
    if (read(head, links) === null) {
      return { app, binder, body, arg: right, path }
    }
  }

  return find(left, links, `${path}0`)
}

/**
 * Lower a pair expression into `[root, links]`.
 *
 * For pair inputs, the initial root is the first allocated link at index `0`.
 * After reduction, the current root may become `null`, an atom, or any link
 * index reachable from the original graph.
 *
 * @param {*} pair
 * If `onref` is provided, out-of-scope `#n` markers are left as atoms so a
 * best-effort contextual view can still be collected from partially reduced
 * expressions. Without `onref`, out-of-scope links are rejected.
 *
 * @param {(ref: { from: string, to: number, toPath: string, depth: number }) => void} [onref]
 * @returns {[*, Array<[*, *]>]}
 */
export const build = (pair, onref = null) => {
  const links = []
  const stack = []

  const lower = (pair, path = 'root') => {
    if (isEmpty(pair)) return null
    if (!Array.isArray(pair)) {
      if (!isRef(pair)) return pair

      const depth = Number(pair.slice(1))
      const frame = stack[stack.length - 1 - depth]
      if (!frame) {
        if (onref) return pair
        throw new Error(`Out-of-scope link: ${pair}`)
      }

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

    const left = lower(pair[0], `${path}0`)
    let right

    if (isEmpty(pair[0])) {
      stack.push({ index, path })
      right = lower(pair[1], `${path}1`)
      stack.pop()
    } else {
      right = lower(pair[1], `${path}1`)
    }

    links[index] = [left, right]
    return index
  }

  return [lower(pair), links]
}

export const collapse = (root, links, oncollapse = null) => {
  const redex = find(root, links)
  if (redex === null) return [root, links]

  const next = links.slice()
  next[redex.binder] = redex.arg
  next[redex.app] = redex.body
  oncollapse?.({ path: redex.path })

  return [root, next]
}

export const materialize = (root, links, ids = null) => {
  const walk = (value, path = 'root', binders = [], seen = new Set()) => {
    const current = read(value, links)
    ids?.set(path, id(value, links) ?? path)

    if (current === null) return []
    if (typeof current !== 'number') return current

    const binder = binders.lastIndexOf(current)
    if (binder !== -1) {
      return `#${binders.length - 1 - binder}`
    }

    if (seen.has(current)) return `#${current}`

    const next = new Set(seen)
    next.add(current)

    const [left, right] = links[current]
    const binderLike = read(left, links) === null
    const nextBinders = binderLike ? [...binders, current] : binders

    return [walk(left, `${path}0`, binders, next),
            walk(right, `${path}1`, nextBinders, next)]
  }

  return walk(root)
}
