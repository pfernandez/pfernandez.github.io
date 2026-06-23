// graph/observe.js, reading u32 addresses from a DataView instead of references.
const isIdentity = (view, address) =>
  view.getUint32(address, true) === address

export const observeAddress = (view, pair, trace) => {
  trace?.(pair)
  const left = view.getUint32(pair, true)
  return isIdentity(view, left)
    ? pair
    : observeAddress(view, left, trace)
}

export const selectAddress = (view, found) =>
  view.getUint32(found + 4, true)
