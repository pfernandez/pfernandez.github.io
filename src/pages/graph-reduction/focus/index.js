/**
 * @module focus
 *
 * Pure focus/context navigation for binary pair terms.
 *
 * This module does not collapse or rotate structure. It only moves an explicit
 * focus through an existing term and can rebuild a new term when the focused
 * subterm is replaced.
 */

const isEmpty = term => Array.isArray(term) && term.length === 0
const isAtom = term => !Array.isArray(term)

const assertPair = term => {
  if (Array.isArray(term) && term.length !== 0 && term.length !== 2)
    throw new Error('Terms must be empty or pairs')
}

const pathBits = path => {
  if (path === 'root') return []
  if (!path.startsWith('root')) throw new Error('Focus paths must start at root')
  const bits = path.slice(4)
  if (!/^[01]+$/.test(bits)) throw new Error('Focus paths may only use 0 and 1')
  return [...bits]
}

/**
 * @typedef {{
 *   parent: *,
 *   path: string,
 *   side: 'left' | 'right',
 *   sibling: *
 * }} FocusFrame
 *
 * @typedef {{
 *   term: *,
 *   focus: *,
 *   path: string,
 *   context: FocusFrame[]
 * }} FocusState
 */

/**
 * Create a focused state at the root of a term.
 *
 * @param {*} term
 * @returns {FocusState}
 */
export const focusRoot = term => {
  assertPair(term)
  return { term, focus: term, path: 'root', context: [] }
}

const descendFocus = (state, side) => {
  assertPair(state.focus)
  if (isAtom(state.focus) || isEmpty(state.focus)) return null

  const [left, right] = state.focus
  return side === 'left'
    ? {
        term: state.term,
        focus: left,
        path: `${state.path}0`,
        context: [...state.context,
                  { parent: state.focus,
                    path: state.path,
                    side: 'left',
                    sibling: right }]
      }
    : {
        term: state.term,
        focus: right,
        path: `${state.path}1`,
        context: [...state.context,
                  { parent: state.focus,
                    path: state.path,
                    side: 'right',
                    sibling: left }]
      }
}

/**
 * Move the focus by one local edge.
 *
 * Supported directions:
 * - `left`
 * - `right`
 * - `up`
 *
 * Returns `null` when that move is not available from the current focus.
 *
 * @param {FocusState} state
 * @param {'left' | 'right' | 'up'} direction
 * @returns {FocusState | null}
 */
export const moveFocus = (state, direction) => {
  if (direction === 'left') return descendFocus(state, 'left')
  if (direction === 'right') return descendFocus(state, 'right')
  if (direction === 'up') {
    const frame = state.context.at(-1)
    return frame
      ? {
          term: state.term,
          focus: frame.parent,
          path: frame.path,
          context: state.context.slice(0, -1)
        }
      : null
  }

  throw new Error(`Unknown focus direction: ${direction}`)
}

/**
 * Focus a term at a specific path.
 *
 * Paths use the tree ids already used elsewhere in the notebook:
 * `root`, `root0`, `root01`, ...
 *
 * @param {*} term
 * @param {string} [path='root']
 * @returns {FocusState}
 */
export const focusAt = (term, path = 'root') =>
  pathBits(path).reduce((state, bit) => {
    const next = moveFocus(state, bit === '0' ? 'left' : 'right')
    if (!next) throw new Error(`Cannot focus ${path}`)
    return next
  }, focusRoot(term))

const rebuildFromContext = (focus, context) =>
  context.reduceRight(
    (child, frame) =>
      frame.side === 'left'
        ? [child, frame.sibling]
        : [frame.sibling, child],
    focus
  )

/**
 * Replace the currently focused subterm and return a new focused state at the
 * same path in the rebuilt term.
 *
 * Untouched siblings are preserved by reference.
 *
 * @param {FocusState} state
 * @param {*} replacement
 * @returns {FocusState}
 */
export const replaceFocus = (state, replacement) =>
  focusAt(rebuildFromContext(replacement, state.context), state.path)

/**
 * Read the current focus value for a term/path pair.
 *
 * @param {*} term
 * @param {string} [path='root']
 * @returns {*}
 */
export const readFocus = (term, path = 'root') =>
  focusAt(term, path).focus

/**
 * Move the focus back to the root while preserving the same term reference.
 *
 * @param {FocusState} state
 * @returns {FocusState}
 */
export const unfocus = state =>
  state.context.length
    ? unfocus(moveFocus(state, 'up'))
    : state
