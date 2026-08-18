// The graph as machine words. A pair's identity is the address of its right
// word, with its left word immediately before it. An atom has one meaningful
// word containing its own address. Padding keeps the two kinds of identity on
// distinct alignments.

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

  for (const [node, address] of addresses) {
    if (isAtom(node)) {
      view.setUint32(address, address, true)
    } else {
      view.setUint32(address - 4, addresses.get(node[0]), true)
      view.setUint32(address, addresses.get(node[1]), true)
    }
  }

  return { bytes, focus: addresses.get(focus), addresses }
}
