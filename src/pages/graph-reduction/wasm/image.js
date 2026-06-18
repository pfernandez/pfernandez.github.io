// The graph as bytes — eight per cell: two little-endian u32 addresses,
// function side then argument side. Pointer identity becomes address
// identity, so an atom is its own address twice.

import { serialize } from '../graph/index.js'

// Address cells in first-visit order; the legend names the atoms.
export const image = graph => {
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
  const legend = new Map()

  for (const [node, addr] of addresses) {
    view.setUint32(addr, addresses.get(node[0]), true)
    view.setUint32(addr + 4, addresses.get(node[1]), true)
    if (node[0] === node && node[1] === node) legend.set(addr, serialize(node))
  }

  return { bytes, focus: addresses.get(graph), legend }
}

// graph/observe.js, reading addresses instead of references.
export const observe = (view, pair, trace) => (
  trace?.(pair),
  view.getUint32(pair, true) === pair ? pair
    : observe(view, view.getUint32(pair, true), trace))

export const select = (view, found) =>
  view.getUint32(found + 4, true)
