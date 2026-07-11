// graph/step.js, reading u32 addresses from a DataView instead of references.
export const stepAddress = (view, pair) =>
  view.getUint32(pair + 4, true)
