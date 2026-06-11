// The graph as bytes — eight per cell: two little-endian u32 addresses,
// function side then argument side. Pointer identity becomes address
// identity, so an atom is its own address twice.

import { serialize } from '../graph.js'

// Address cells in first-visit order; the legend names the atoms.
export const image = graph => {
  const placed = new Map()
  const place = node => {
    if (placed.has(node)) return
    if (!Array.isArray(node) || node.length !== 2)
      throw new Error('Image cells must be pairs')
    placed.set(node, placed.size * 8)
    node.forEach(place)
  }
  place(graph)

  const bytes = new Uint8Array(placed.size * 8)
  const view = new DataView(bytes.buffer)
  const legend = new Map()

  for (const [node, addr] of placed) {
    view.setUint32(addr, placed.get(node[0]), true)
    view.setUint32(addr + 4, placed.get(node[1]), true)
    if (node[0] === node && node[1] === node) legend.set(addr, serialize(node))
  }

  return { bytes, focus: placed.get(graph), legend }
}

// graph.js observe and select, reading addresses instead of references.
export const observe = (view, pair, trace) => (
  trace?.(pair),
  view.getUint32(pair, true) === pair ? pair
    : observe(view, view.getUint32(pair, true), trace))

export const select = (view, found) =>
  view.getUint32(found + 4, true)

// graph.js serialize: atoms print from the legend, repeats print as the
// path where they first appeared.
export const imageSerialize = (view, root, legend, seen = new Map()) => {
  const walk = (addr, path) =>
    legend.has(addr) ? String(legend.get(addr))
      : seen.has(addr) ? seen.get(addr)
        : (seen.set(addr, path),
          `(${walk(view.getUint32(addr, true), `${path}.0`)} ${walk(view.getUint32(addr + 4, true), `${path}.1`)})`)

  return walk(root, '$')
}
