/**
 * @module collapse
 *
 * Minimal collapse interpreter.
 *
 * One rule:
 *   (() x) -> x
 *
 * `collapse` performs a single step using a leftmost-outermost schedule.
 * Only the left branch is searched. The right branch is left untouched until
 * a collapse exposes it.
 */

const isEmpty = term => Array.isArray(term) && term.length === 0
const isAtom = term => !Array.isArray(term)

const assertPair = term => {
  if (Array.isArray(term) && term.length !== 0 && term.length !== 2)
    throw new Error('Terms must be empty or pairs')
}

/**
 * Trace a single collapse step as an explicit machine.
 *
 * Frame types:
 * - `descend`: move the focus into the left branch
 * - `collapse`: apply `(() x) -> x`
 * - `return`: return through one suspended context on the way back out
 * - `stable`: no collapse is reachable under this schedule
 *
 * `path` uses the same ids as the tree layout: `root`, `root0`, `root00`, ...
 *
 * `context` is the surrounding structure. Given a replacement for the current
 * focus, it rebuilds the whole term.
 */
export const traceCollapse = term => {
  const frames = []

  const emit = (type, path, shown) => frames.push({ type, path, term: shown })

  const traceAt = (focus, path, context) => {
    assertPair(focus)

    // TBD: Distinguish reducible structure from quoted data.
    if (isAtom(focus) || isEmpty(focus)) {
      emit('stable', path, context(focus))
      return { changed: false, focus }
    }

    const [left, right] = focus

    if (isEmpty(left)) {
      emit('collapse', path, context(right))
      return { changed: true, focus: right }
    }

    const childPath = `${path}0`
    emit('descend', childPath, context(focus))

    const next = traceAt(
      left,
      childPath,
      nextLeft => context([nextLeft, right]))

    if (!next.changed) return { changed: false, focus }

    const rebuilt = [next.focus, right]
    emit('return', path, context(rebuilt))
    return { changed: true, focus: rebuilt }
  }

  const next = traceAt(term, 'root', x => x)

  return { after: next.focus, changed: next.changed, frames }
}

export const collapse = term => traceCollapse(term).after
