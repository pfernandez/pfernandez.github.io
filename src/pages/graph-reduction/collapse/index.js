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
 * Event types:
 * - `descend`: send into the left branch
 * - `collapse`: annihilate `()` and expose the continuation
 * - `return`: resume through one suspended context on the way back out
 * - `stable`: no collapse is reachable under this schedule
 *
 * `path` uses the same ids as the tree layout: `root`, `root0`, `root00`, ...
 *
 * `surround` is the suspended structure around the current branch. Given a
 * replacement for that branch, it rebuilds the whole term.
 */
export const traceCollapse = term => {
  const frames = []

  const emit = (type, path, shown) => frames.push({ type, path, term: shown })

  const traceAt = (current, path, surround) => {
    assertPair(current)

    // TBD: Distinguish reducible structure from quoted data.
    if (isAtom(current) || isEmpty(current)) {
      emit('stable', path, surround(current))
      return { changed: false, current }
    }

    const [left, right] = current

    if (isEmpty(left)) {
      emit('collapse', path, surround(right))
      return { changed: true, current: right }
    }

    const childPath = `${path}0`
    emit('descend', childPath, surround(current))

    const next = traceAt(
      left,
      childPath,
      nextLeft => surround([nextLeft, right]))

    if (!next.changed) return { changed: false, current }

    const resumed = [next.current, right]
    emit('return', path, surround(resumed))
    return { changed: true, current: resumed }
  }

  const next = traceAt(term, 'root', x => x)

  return { after: next.current, changed: next.changed, frames }
}

export const collapse = term => traceCollapse(term).after
