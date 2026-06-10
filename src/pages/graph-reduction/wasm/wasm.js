// every program is the same machine: a four-instruction reader stapled to its
// record; programs differ only in their data segment, their focus, and their
// legend

import { compile } from '../graph.js'
import { image, imageSerialize, observe as walk } from './image.js'

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

const name = text => [...uleb(utf8(text).length), ...utf8(text)]

const section = (id, body) => [id, ...uleb(body.length), ...body]

export const emit = ({ bytes, focus, legend }) => {
  const observe = [
    0x00,                              // no locals
    0x02, 0x40, 0x03, 0x40,            // block, loop
    0x20, 0x00, 0x28, 0x02, 0x00,      //   mem[p]
    0x20, 0x00, 0x46, 0x0d, 0x01,      //   == p ? done
    0x20, 0x00, 0x28, 0x02, 0x00,      //   p = mem[p]
    0x21, 0x00, 0x0c, 0x00,            //   again
    0x0b, 0x0b, 0x20, 0x00, 0x0b
  ]      // p

  const select = [
    0x00,
    0x20, 0x00, 0x28, 0x02, 0x04,      // mem[p + 4]
    0x0b
  ]

  const entries = [...legend].flatMap(([addr, spelling]) =>
    [...uleb(addr), ...name(String(spelling))])

  return Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, [0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f]),
    ...section(3, [0x02, 0x00, 0x00]),
    ...section(5, [0x01, 0x00, ...uleb(Math.max(1, Math.ceil(bytes.length / 65536)))]),
    ...section(6, [0x01, 0x7f, 0x00, 0x41, ...sleb(focus), 0x0b]),
    ...section(7, [
      0x04,
      ...name('memory'), 0x02, 0x00,
      ...name('focus'), 0x03, 0x00,
      ...name('observe'), 0x00, 0x00,
      ...name('select'), 0x00, 0x01
    ]),
    ...section(10, [
      0x02,
      ...uleb(observe.length), ...observe,
      ...uleb(select.length), ...select
    ]),
    ...section(11, [0x01, 0x00, 0x41, ...sleb(0), 0x0b, ...uleb(bytes.length), ...bytes]),
    ...section(0, [...name('legend'), ...uleb(legend.size), ...entries])
  ])
}

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

export const sections = bytes => {
  const r = reader(bytes)
  const found = []
  r.seek(8)
  while (r.more()) {
    const id = r.byte()
    const size = r.leb()
    const start = r.tell()
    found.push({ id, body: bytes.subarray(start, start + size) })
    r.seek(start + size)
  }
  return found
}

export const readLegend = bytes => {
  for (const { id, body } of sections(bytes)) {
    if (id !== 0) continue
    const r = reader(body)
    if (r.text() !== 'legend') continue

    const legend = new Map()
    let count = r.leb()
    while (count--) legend.set(r.leb(), r.text())
    return legend
  }
  return new Map()
}

export const run = async bytes => {
  const legend = readLegend(bytes)
  const { instance } = await WebAssembly.instantiate(bytes)
  const { memory, focus } = instance.exports
  const view = new DataView(memory.buffer)

  let N = 0
  const trace = addr => console.log(N++, imageSerialize(view, addr, legend), '\n')

  const found = walk(view, focus.value, trace)
  const machine = instance.exports.observe(focus.value)
  if (machine !== found) throw new Error('The machine disagrees with the record')

  trace(instance.exports.select(machine))
  return instance
}

const main = () =>
  typeof process !== 'undefined'
    && process.argv[1]
    && decodeURIComponent(new URL(import.meta.url).pathname) === process.argv[1]

if (main()) {
  const { readFileSync, writeFileSync } = await import('node:fs')
  const path = process.argv[2]
    ?? decodeURIComponent(new URL('./core.lisp', import.meta.url).pathname)

  let bytes
  if (path.endsWith('.wasm')) {
    bytes = new Uint8Array(readFileSync(path))
  } else {
    bytes = emit(image(compile(readFileSync(path, 'utf-8'))))
    const out = path.replace(/\.[^./]+$/, '') + '.wasm'
    writeFileSync(out, bytes)
    console.log(out, '—', bytes.length, 'bytes\n')
  }

  await run(bytes)
}
