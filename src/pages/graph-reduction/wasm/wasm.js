// Every module uses the same step machine; each graph differs only
// in bytes, focus, and legend.

import { addressLegend, link, traceWasm } from '../graph/index.js'
import { stepAddress } from './address.js'
import { image } from './image.js'
import { emit, readLegend } from './module.js'

export { emit, readLegend, sections } from './module.js'

// Replay one step in JS over exported memory, run wasm step, and insist
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

  traceWasm(view, focus.value, traceOptions)
  const foundByImage = stepAddress(view, focus.value)
  const foundByWasm = instance.exports.step(focus.value)
  if (foundByWasm !== foundByImage)
    throw new Error('Wasm step disagrees with image step')

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
    const linked = link(readFileSync(path, 'utf-8'))
    if (linked.error) throw linked.error
    const graphImage = image(linked.graph, linked.focus)
    bytes = emit({
      ...graphImage,
      legend: addressLegend(graphImage)
    })
    const out = path === source
      ? decodeURIComponent(new URL('./core.wasm', import.meta.url).pathname)
      : path.replace(/\.[^./]+$/, '') + '.wasm'
    writeFileSync(out, bytes)
    console.log(out, '—', bytes.length, 'bytes\n')
  }

  await run(bytes)
}
