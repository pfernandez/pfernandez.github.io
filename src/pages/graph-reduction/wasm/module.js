// LEB128 integers: unsigned for sizes and counts, signed for constants.
const uleb = n => {
  const out = []
  do {
    const b = n & 0x7f
    n >>>= 7
    out.push(n ? b | 0x80 : b)
  } while (n)
  return out
}

const sleb = n => {
  const out = []
  for (;;) {
    const b = n & 0x7f
    n >>= 7
    if (n === 0 && !(b & 0x40) || n === -1 && b & 0x40) return [...out, b]
    out.push(b | 0x80)
  }
}

const utf8 = text => [...new TextEncoder().encode(text)]

// A name is its byte length, then its utf-8 bytes.
const name = text => [...uleb(utf8(text).length), ...utf8(text)]

// A section is its id, its size, then its body.
const section = (id, body) => [id, ...uleb(body.length), ...body]

export const emit = ({ bytes, focus, legend = new Map() }) => {
  // step(p): return mem[p]
  const step = [
    0x00,                              // no locals
    0x20, 0x00, 0x28, 0x02, 0x00,      // return mem[p]
    0x0b
  ]

  const entries = [...legend].flatMap(([addr, spelling]) =>
    [...uleb(addr), ...name(String(spelling))])

  return Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,    // \0asm, version 1
    // type: one signature, i32 -> i32
    ...section(1, [0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f]),
    // function: step
    ...section(3, [0x01, 0x00]),
    // memory: enough 64K pages to hold the graph bytes
    ...section(5, [0x01, 0x00,
                   ...uleb(Math.max(1, Math.ceil(bytes.length / 65536)))]),
    // global: focus, the address stepping starts from
    ...section(6, [0x01, 0x7f, 0x00, 0x41, ...sleb(focus), 0x0b]),
    // exports
    ...section(7, [
      0x03,
      ...name('memory'), 0x02, 0x00,
      ...name('focus'), 0x03, 0x00,
      ...name('step'), 0x00, 0x00
    ]),
    // code: step
    ...section(10, [
      0x01,
      ...uleb(step.length), ...step
    ]),
    // data: the graph bytes, at address 0
    ...section(11, [0x01, 0x00, 0x41,
                    ...sleb(0), 0x0b, ...uleb(bytes.length), ...bytes]),
    // custom: the legend — address and spelling for every atom
    ...section(0, [...name('legend'), ...uleb(legend.size), ...entries])
  ])
}

// A byte cursor: single bytes, LEB128 integers, length-prefixed text.
const reader = body => {
  let at = 0
  const byte = () => body[at++]
  const leb = () => {
    let n = 0
    let shift = 0
    for (;;) {
      const b = byte()
      n |= (b & 0x7f) << shift
      if (!(b & 0x80)) return n >>> 0
      shift += 7
    }
  }
  const text = () => {
    const length = leb()
    const decoded = new TextDecoder().decode(body.subarray(at, at + length))
    at += length
    return decoded
  }
  return { byte, leb, text,
           more: () => at < body.length,
           seek: to => { at = to },
           tell: () => at }
}

// After the eight header bytes, a module is sections: id, size, body.
export const sections = bytes => {
  const read = reader(bytes)
  const found = []
  read.seek(8)
  while (read.more()) {
    const id = read.byte()
    const size = read.leb()
    const start = read.tell()
    found.push({ id, body: bytes.subarray(start, start + size) })
    read.seek(start + size)
  }
  return found
}

// Rebuild the address → spelling map from the legend section.
export const readLegend = bytes => {
  for (const { id, body } of sections(bytes)) {
    if (id !== 0) continue
    const read = reader(body)
    if (read.text() !== 'legend') continue

    const legend = new Map()
    let count = read.leb()
    while (count--) legend.set(read.leb(), read.text())
    return legend
  }
  return new Map()
}
