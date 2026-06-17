// The graph as bytes — eight per cell: two little-endian u32 addresses,
// function side then argument side. Pointer identity becomes address
// identity, so an atom is its own address twice.

import { partsToAnsi, serialize } from '../graph.js'

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

// graph.js observe and select, reading addresses instead of references.
export const observe = (view, pair, trace) => (
  trace?.(pair),
  view.getUint32(pair, true) === pair ? pair
    : observe(view, view.getUint32(pair, true), trace))

export const select = (view, found) =>
  view.getUint32(found + 4, true)

// graph.js serialize, reading addresses: atoms print from the legend,
// repeats print as the path where the cell first appeared.
export const serializeImage = (view, root, legend, pathsByAddr = new Map()) => {
  const printAddr = (addr, path) => {
    if (legend.has(addr)) return String(legend.get(addr))
    if (pathsByAddr.has(addr)) return pathsByAddr.get(addr)

    pathsByAddr.set(addr, path)
    const left = printAddr(view.getUint32(addr, true), `${path}.0`)
    const right = printAddr(view.getUint32(addr + 4, true), `${path}.1`)
    return `(${left} ${right})`
  }

  return printAddr(root, '$')
}

// graph.js serializeParts, reading addresses.
export const serializeImageParts = (view, root, legend) => {
  const seen = new Set()
  const identities = new Map()

  const printAddr = addr => {
    if (legend.has(addr)) return [{ text: String(legend.get(addr)) }]

    if (!identities.has(addr)) identities.set(addr, identities.size)
    const identity = identities.get(addr)
    if (seen.has(addr)) return [{ text: '()', identity }]

    seen.add(addr)
    const left = printAddr(view.getUint32(addr, true))
    const right = printAddr(view.getUint32(addr + 4, true))
    return [
      { text: '(', identity },
      ...left,
      { text: ' ' },
      ...right,
      { text: ')', identity }
    ]
  }

  return printAddr(root)
}

export const serializeImageAnsi = (view, root, legend, scheme = 'color') =>
  partsToAnsi(serializeImageParts(view, root, legend), scheme)

export const serializeImageColor = serializeImageAnsi
