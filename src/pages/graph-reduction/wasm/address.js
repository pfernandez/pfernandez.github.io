// Pair identities point to their right word. Atom identities point to their
// single meaningful word; the following word is padding.
export const isAtomAddress = address => address % 8 === 0

export const leftAddress = (view, address) =>
  view.getUint32(address - (isAtomAddress(address) ? 0 : 4), true)

export const rightAddress = (view, address) =>
  view.getUint32(address, true)

// graph/step.js, reading u32 addresses from a DataView instead of references.
export const stepAddress = rightAddress
