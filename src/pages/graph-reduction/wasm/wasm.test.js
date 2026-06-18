import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  imageLegend,
  observe,
  select,
  serialize,
  serializeImage
} from '../graph/index.js'
import {
  observeAddress,
  selectAddress
} from './address.js'
import { image } from './image.js'
import { emit, readLegend, sections } from './wasm.js'

const source = arg =>
  `(((I x) x) (I ${arg}))`

const program = arg =>
  compile(source(arg))

const step = node =>
  select(observe(node))

const view = bytes =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const loadMachine = async graph => {
  const graphImage = image(graph)
  const authoredLegend = imageLegend(graphImage)
  const bytes = emit({ ...graphImage, legend: authoredLegend })
  const { instance } = await WebAssembly.instantiate(bytes)

  return { focus: graphImage.focus,
           authoredLegend,
           legend: readLegend(bytes),
           memory: new DataView(instance.exports.memory.buffer),
           exports: instance.exports,
           bytes }
}

describe('the image is the graph', () => {
  test('image observation agrees with the graph engine', () => {
    const graph = program('a')
    const graphImage = image(graph)
    const { bytes, focus } = graphImage
    const legend = imageLegend(graphImage)
    const memory = view(bytes)
    const found = observeAddress(memory, focus)

    assert.equal(serializeImage(memory, found, legend), serialize(observe(graph)))
    assert.equal(
      serializeImage(memory, selectAddress(memory, found), legend),
      serialize(step(graph)))
  })

  test('atoms are their own address, twice', () => {
    const graphImage = image(program('a'))
    const { bytes } = graphImage
    const legend = imageLegend(graphImage)
    const memory = view(bytes)

    assert.ok(legend.size >= 1)
    for (const addr of legend.keys()) {
      assert.equal(memory.getUint32(addr, true), addr)
      assert.equal(memory.getUint32(addr + 4, true), addr)
    }
  })
})

describe('the machine runs graph bytes', () => {
  test('the wasm engine observes the wired I graph', async () => {
    const graph = program('a')
    const machine = await loadMachine(graph)
    const found = machine.exports.observe(machine.exports.focus.value)
    const payload = machine.exports.select(found)

    assert.equal(machine.exports.focus.value, machine.focus)
    assert.equal(
      serializeImage(machine.memory, payload, machine.legend),
      serialize(step(graph)))
  })

  test('observation is idempotent inside the machine', async () => {
    const machine = await loadMachine(program('a'))
    const found = machine.exports.observe(machine.focus)

    assert.equal(machine.exports.observe(found), found)
    assert.equal(machine.exports.observe(machine.exports.observe(found)), found)
  })

  test('the module is self-contained: the legend round-trips', async () => {
    const machine = await loadMachine(program('a'))

    assert.deepEqual([...machine.legend], [...machine.authoredLegend])
  })

  test('every program is the same machine', () => {
    const emitGraph = graph => {
      const graphImage = image(graph)
      return emit({ ...graphImage, legend: imageLegend(graphImage) })
    }
    const a = sections(emitGraph(program('a')))
    const b = sections(emitGraph(program('b')))
    const body = (list, id) =>
      Buffer.from(list.find(section => section.id === id).body).toString('hex')

    for (const id of [1, 3, 5, 6, 7, 10, 11])
      assert.equal(body(a, id), body(b, id))
    assert.notEqual(body(a, 0), body(b, 0))
  })
})
