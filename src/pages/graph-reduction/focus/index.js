/**
 * @module focus
 *
 * Pure observer-plane navigation for binary pair terms.
 *
 * The substrate stays fixed. What changes is which part of the substrate is
 * centered in a fixed observer plane.
 *
 * This module does not collapse or rotate structure. It only re-centers the
 * substrate through an existing term and can rebuild a new term when the
 * subterm currently centered in the plane is replaced.
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
    throw new Error('Addresses must start at root')
  const bits = address.slice(4)
  if (!/^[01]+$/.test(bits)) throw new Error('Addresses may only use 0 and 1')
  return [...bits]
}

/**
 * @typedef {{
 *   parent: *,
 *   address: string,
 *   side: 'left' | 'right',
 *   sibling: *
 * }} TrailFrame
 *
 * @typedef {{
 *   substrate: *,
 *   centered: *,
 *   address: string,
 *   trail: TrailFrame[]
 * }} FocusState
 */

/**
 * Internal state constructor.
 *
 * @param {*} substrate
 * @param {*} centered
 * @param {string} address
 * @param {TrailFrame[]} trail
 * @returns {FocusState}
 */
const makeState = (substrate, centered, address, trail) =>
  ({ substrate,
     centered,
     address,
     trail })

/**
 * Center the whole substrate in the observer plane.
 *
 * @param {*} term
 * @returns {FocusState}
 */
export const centerRoot = term => {
  assertPair(term)
  return makeState(term, term, 'root', [])
}

const panInto = (state, side) => {
  assertPair(state.centered)
  if (isAtom(state.centered) || isEmpty(state.centered)) return null

  const [left, right] = state.centered
  return side === 'left'
    ? makeState(
      state.substrate,
      left,
      `${state.address}0`,
      [...state.trail,
       { parent: state.centered,
         address: state.address,
         side: 'left',
         sibling: right }])
    : makeState(
      state.substrate,
      right,
      `${state.address}1`,
      [...state.trail,
       { parent: state.centered,
         address: state.address,
         side: 'right',
         sibling: left }])
}

/**
 * Pan the substrate by one local edge relative to the fixed observer plane.
 *
 * Supported directions:
 * - `left`
 * - `right`
 * - `up`
 *
 * Returns `null` when that move is not available from the current center.
 *
 * @param {FocusState} state
 * @param {'left' | 'right' | 'up'} direction
 * @returns {FocusState | null}
 */
export const pan = (state, direction) => {
  if (direction === 'left') return panInto(state, 'left')
  if (direction === 'right') return panInto(state, 'right')
  if (direction === 'up') {
    const trailFrame = state.trail.at(-1)
    return trailFrame
      ? makeState(
        state.substrate,
        trailFrame.parent,
        trailFrame.address,
        state.trail.slice(0, -1))
      : null
  }

  throw new Error(`Unknown pan direction: ${direction}`)
}

/**
 * Center a specific address of the substrate in the observer plane.
 *
 * Addresses use the tree ids already used elsewhere in the notebook:
 * `root`, `root0`, `root01`, ...
 *
 * @param {*} term
 * @param {string} [address='root']
 * @returns {FocusState}
 */
export const centerOn = (term, address = 'root') =>
  addressBits(address).reduce((state, bit) => {
    const next = pan(state, bit === '0' ? 'left' : 'right')
    if (!next) throw new Error(`Cannot center ${address}`)
    return next
  }, centerRoot(term))

const rebuildSubstrate = (centered, trail) =>
  trail.reduceRight(
    (child, trailFrame) =>
      trailFrame.side === 'left'
        ? [child, trailFrame.sibling]
        : [trailFrame.sibling, child],
    centered
  )

/**
 * Replace the subterm currently centered in the observer plane and return a
 * new centered state at the same address in the rebuilt substrate.
 *
 * Untouched siblings are preserved by reference.
 *
 * @param {FocusState} state
 * @param {*} replacement
 * @returns {FocusState}
 */
export const replaceCentered = (state, replacement) =>
  centerOn(rebuildSubstrate(replacement, state.trail), state.address)

/**
 * Read the subterm currently centered in the observer plane.
 *
 * @param {*} term
 * @param {string} [address='root']
 * @returns {*}
 */
export const readCentered = (term, address = 'root') =>
  centerOn(term, address).centered

/**
 * Return the observer plane to the whole substrate.
 *
 * This does not need to walk back up the trail. The root view is just the same
 * substrate centered at `root`.
 *
 * @param {FocusState} state
 * @returns {FocusState}
 */
export const returnToRoot = state => centerRoot(state.substrate)
