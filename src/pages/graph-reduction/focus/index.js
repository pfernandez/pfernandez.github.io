/**
 * @module focus
 *
 * Pure observer-frame navigation for binary pair terms.
 *
 * The substrate stays fixed. What changes is the local origin from which the
 * substrate is being expressed.
 *
 * This module does not collapse or rotate structure. It only shifts an
 * explicit origin through an existing term and can rebuild a new term when the
 * subterm currently presented at that origin is replaced.
 */

const isEmpty = term => Array.isArray(term) && term.length === 0
const isAtom = term => !Array.isArray(term)

const assertPair = term => {
  if (Array.isArray(term) && term.length !== 0 && term.length !== 2)
    throw new Error('Terms must be empty or pairs')
}

const addressBits = address => {
  if (address === 'root') return []
  if (!address.startsWith('root'))
    throw new Error('Focus addresses must start at root')
  const bits = address.slice(4)
  if (!/^[01]+$/.test(bits)) throw new Error('Focus paths may only use 0 and 1')
  return [...bits]
}

/**
 * @typedef {{
 *   parent: *,
 *   address: string,
 *   side: 'left' | 'right',
 *   sibling: *
 * }} OriginFrame
 *
 * @typedef {{
 *   substrate: *,
 *   origin: *,
 *   address: string,
 *   frame: OriginFrame[],
 *   term: *,
 *   focus: *,
 *   path: string,
 *   context: OriginFrame[]
 * }} FocusState
 */

/**
 * Internal state constructor.
 *
 * The legacy `term` / `focus` / `path` / `context` names remain as aliases so
 * older notebook code can keep working while the source shifts toward the
 * observer-frame vocabulary.
 *
 * @param {*} substrate
 * @param {*} origin
 * @param {string} address
 * @param {OriginFrame[]} frame
 * @returns {FocusState}
 */
const makeState = (substrate, origin, address, frame) =>
  ({ substrate,
     origin,
     address,
     frame,
     term: substrate,
     focus: origin,
     path: address,
     context: frame })

/**
 * Create an observer state at the root of a term.
 *
 * @param {*} term
 * @returns {FocusState}
 */
export const observeRoot = term => {
  assertPair(term)
  return makeState(term, term, 'root', [])
}

const shiftInto = (state, side) => {
  assertPair(state.origin)
  if (isAtom(state.origin) || isEmpty(state.origin)) return null

  const [left, right] = state.origin
  return side === 'left'
    ? makeState(
      state.substrate,
      left,
      `${state.address}0`,
      [...state.frame,
       { parent: state.origin,
         address: state.address,
         side: 'left',
         sibling: right }])
    : makeState(
      state.substrate,
      right,
      `${state.address}1`,
      [...state.frame,
       { parent: state.origin,
         address: state.address,
         side: 'right',
         sibling: left }])
}

/**
 * Shift the observer origin by one local edge.
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
export const shiftOrigin = (state, direction) => {
  if (direction === 'left') return shiftInto(state, 'left')
  if (direction === 'right') return shiftInto(state, 'right')
  if (direction === 'up') {
    const frame = state.frame.at(-1)
    return frame
      ? makeState(
        state.substrate,
        frame.parent,
        frame.address,
        state.frame.slice(0, -1))
      : null
  }

  throw new Error(`Unknown focus direction: ${direction}`)
}

/**
 * Express a term from a specific origin address.
 *
 * Addresses use the tree ids already used elsewhere in the notebook:
 * `root`, `root0`, `root01`, ...
 *
 * @param {*} term
 * @param {string} [address='root']
 * @returns {FocusState}
 */
export const observeAt = (term, address = 'root') =>
  addressBits(address).reduce((state, bit) => {
    const next = shiftOrigin(state, bit === '0' ? 'left' : 'right')
    if (!next) throw new Error(`Cannot focus ${address}`)
    return next
  }, observeRoot(term))

const rebuildFromFrame = (origin, frame) =>
  frame.reduceRight(
    (child, frame) =>
      frame.side === 'left'
        ? [child, frame.sibling]
        : [frame.sibling, child],
    origin
  )

/**
 * Replace the subterm currently presented at the origin and return a new
 * observer state at the same address in the rebuilt substrate.
 *
 * Untouched siblings are preserved by reference.
 *
 * @param {FocusState} state
 * @param {*} replacement
 * @returns {FocusState}
 */
export const replaceOrigin = (state, replacement) =>
  observeAt(rebuildFromFrame(replacement, state.frame), state.address)

/**
 * Read the subterm currently presented at an origin address.
 *
 * @param {*} term
 * @param {string} [address='root']
 * @returns {*}
 */
export const readOrigin = (term, address = 'root') =>
  observeAt(term, address).origin

/**
 * Return the origin to the root while preserving the same substrate
 * reference.
 *
 * @param {FocusState} state
 * @returns {FocusState}
 */
export const recenter = state =>
  state.frame.length
    ? recenter(shiftOrigin(state, 'up'))
    : state

// Legacy aliases kept so the notebook can migrate gradually.
export const focusRoot = observeRoot
export const moveFocus = shiftOrigin
export const focusAt = observeAt
export const replaceFocus = replaceOrigin
export const readFocus = readOrigin
export const unfocus = recenter
