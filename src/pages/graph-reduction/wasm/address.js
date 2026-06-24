// graph/observe.js, reading u32 addresses from a DataView instead of references.
export const observeAddress = (view, pair, trace) => (
  trace?.(pair),
  view.getUint32(pair, true) === pair
    ? view.getUint32(pair + 4, true)
    : observeAddress(view, view.getUint32(pair, true), trace))
