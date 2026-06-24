// The graph as bytes: eight per cell, two little-endian u32 addresses,
// function side then argument side. Pointer identity becomes address
// identity, so an atom is its own address twice.

// Address cells in first-visit order.
export const image = (graph, focus = graph) => {
  const addresses = new Map()
  const place = node => {
    if (addresses.has(node)) return
    if (!Array.isArray(node) || node.length !== 2)
      throw new Error('Image cells must be pairs')
    addresses.set(node, addresses.size * 8)
    node.forEach(place)
  }
  place(graph)

  const bytes = new Uint8Array(addresses.size * 8)
  const view = new DataView(bytes.buffer)

  for (const [node, addr] of addresses) {
    view.setUint32(addr, addresses.get(node[0]), true)
    view.setUint32(addr + 4, addresses.get(node[1]), true)
  }

  return { bytes, focus: addresses.get(focus), addresses }
}
