// graph/observe.js, reading u32 addresses from a DataView instead of references.
export const observeAddress = (view, pair, trace) => (
  trace?.(pair),
  view.getUint32(pair, true) === pair ? pair
    : observeAddress(view, view.getUint32(pair, true), trace))

export const selectAddress = (view, found) =>
  view.getUint32(found + 4, true)
