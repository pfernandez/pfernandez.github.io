// Every module uses the same observe machine; each graph differs only
// in bytes, focus, and legend.

import { addressLegend, compile, traceWasm } from '../graph/index.js'
import { observeAddress } from './address.js'
import { image } from './image.js'

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
  // observe(p): follow function sides until mem[p] == p, then return its right
  const observe = [
    0x00,                              // no locals
    0x02, 0x40, 0x03, 0x40,            // block, loop
    0x20, 0x00, 0x28, 0x02, 0x00,      //   load mem[p]
    0x20, 0x00, 0x46, 0x0d, 0x01,      //   equal to p? exit loop
    0x20, 0x00, 0x28, 0x02, 0x00,      //   p = mem[p]
    0x21, 0x00, 0x0c, 0x00,            //   again
    0x0b, 0x0b,                        // end loop, end block
    0x20, 0x00, 0x28, 0x02, 0x04,      // return mem[p + 4]
    0x0b
  ]

  const entries = [...legend].flatMap(([addr, spelling]) =>
    [...uleb(addr), ...name(String(spelling))])

  return Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,    // \0asm, version 1
    // type: one signature, i32 -> i32
    ...section(1, [0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f]),
    // function: observe
    ...section(3, [0x01, 0x00]),
    // memory: enough 64K pages to hold the graph bytes
    ...section(5, [0x01, 0x00,
                   ...uleb(Math.max(1, Math.ceil(bytes.length / 65536)))]),
    // global: focus, the address observation starts from
    ...section(6, [0x01, 0x7f, 0x00, 0x41, ...sleb(focus), 0x0b]),
    // exports
    ...section(7, [
      0x03,
      ...name('memory'), 0x02, 0x00,
      ...name('focus'), 0x03, 0x00,
      ...name('observe'), 0x00, 0x00
    ]),
    // code: observe
    ...section(10, [
      0x01,
      ...uleb(observe.length), ...observe
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

// Replay observation in JS over exported memory, run wasm observe, and insist
// they agree.
export const run = async bytes => {
  const legend = readLegend(bytes)
  const { instance } = await WebAssembly.instantiate(bytes)
  const { memory, focus } = instance.exports
  const view = new DataView(memory.buffer)
  const traceOptions = {
    count: true,
    legend,
    format: 'ansi'
  }

  const foundByImage =
    observeAddress(view, focus.value, root =>
      traceWasm(view, root, traceOptions))
  const foundByWasm = instance.exports.observe(focus.value)
  if (foundByWasm !== foundByImage)
    throw new Error('Wasm observe disagrees with image observe')

  traceWasm(view, foundByWasm, traceOptions)
  return instance
}

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const source = decodeURIComponent(new URL('../core.lisp', import.meta.url).pathname)
  const path = process.argv[2]
    ?? source

  let bytes
  if (path.endsWith('.wasm')) {
    bytes = new Uint8Array(readFileSync(path))
  } else {
    const compiled = compile(readFileSync(path, 'utf-8'))
    if (compiled.error) throw compiled.error
    const graphImage = image(compiled.graph)
    bytes = emit({
      ...graphImage,
      legend: addressLegend(graphImage, compiled.legend)
    })
    const out = path === source
      ? decodeURIComponent(new URL('./core.wasm', import.meta.url).pathname)
      : path.replace(/\.[^./]+$/, '') + '.wasm'
    writeFileSync(out, bytes)
    console.log(out, '—', bytes.length, 'bytes\n')
  }

  await run(bytes)
}
