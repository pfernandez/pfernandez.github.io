/** Convert values recognized as named entries into one host object. */
export const record = (nodes, entry) => Object.fromEntries(
  nodes.flatMap(node => {
    const pair = entry(node)
    return pair ? [pair] : []
  })
)
