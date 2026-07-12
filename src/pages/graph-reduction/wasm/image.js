// The graph as machine words. A pair is stored as two adjacent u32 addresses:
// left at base, right at base + 4. The address of the pair is its right edge,
// so step can be one plain load from the current address. An atom is one
// meaningful word whose value is its own address.

const isAtom = node =>
  node[0] === node && node[1] === node

// Address nodes in first-visit order.
export const image = (graph, focus = graph) => {
  const addresses = new Map()
  let size = 0

  const place = node => {
    if (addresses.has(node)) return
    if (!Array.isArray(node) || node.length !== 2)
      throw new Error('Image cells must be pairs')

    if (isAtom(node)) {
      addresses.set(node, size)
      // The second word is padding: it keeps atoms on pair-base alignment, so
      // right-edge pair addresses are always distinguishable as base + 4.
      size += 8
    } else {
      addresses.set(node, size + 4)
      size += 8
      node.forEach(place)
    }
  }

  place(graph)

  const bytes = new Uint8Array(size)
  const view = new DataView(bytes.buffer)

  for (const [node, addr] of addresses) {
    if (isAtom(node)) {
      view.setUint32(addr, addr, true)
    } else {
      view.setUint32(addr - 4, addresses.get(node[0]), true)
      view.setUint32(addr, addresses.get(node[1]), true)
    }
  }

  return { bytes, focus: addresses.get(focus), addresses }
}
