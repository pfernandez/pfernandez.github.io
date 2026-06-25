import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  addressLegend,
  compile,
  observe,
  serialize,
  serializeWasm
} from '../graph/index.js'
import { observeAddress } from './address.js'
import { image } from './image.js'
import { emit, readLegend, sections } from './wasm.js'

const source = arg =>
  `(I (${arg} ${arg}))`

const program = arg =>
  compile(source(arg))

const view = bytes =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const loadMachine = async compiled => {
  const graphImage = image(compiled.graph)
  const authoredLegend = addressLegend(graphImage, compiled.legend)
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
    const compiled = program('a')
    const graphImage = image(compiled.graph)
    const { bytes, focus } = graphImage
    const legend = addressLegend(graphImage, compiled.legend)
    const memory = view(bytes)
    const found = observeAddress(memory, focus)

    assert.equal(
      serializeWasm(memory, found, { legend }),
      serialize(observe(compiled.graph), { legend: compiled.legend }))
  })

  test('source identities retain their links', () => {
    const compiled = program('a')
    const graphImage = image(compiled.graph)
    const { bytes } = graphImage
    const legend = addressLegend(graphImage, compiled.legend)
    const memory = view(bytes)
    const address = name =>
      [...legend].find(([, entry]) => entry === name)[0]
    const a = address('a')
    const I = address('I')

    assert.equal(memory.getUint32(a, true), a)
    assert.equal(memory.getUint32(a + 4, true), a)
    assert.equal(memory.getUint32(I, true), I)
    assert.equal(memory.getUint32(I + 4, true), a)
  })
})

describe('the machine runs graph bytes', () => {
  test('the wasm engine observes the source graph', async () => {
    const compiled = program('a')
    const machine = await loadMachine(compiled)
    const result = machine.exports.observe(machine.exports.focus.value)

    assert.equal(machine.exports.focus.value, machine.focus)
    assert.equal(
      serializeWasm(machine.memory, result, { legend: machine.legend }),
      serialize(observe(compiled.graph), { legend: compiled.legend }))
  })

  test('observation is idempotent inside the machine', async () => {
    const machine = await loadMachine(program('a'))
    const found = machine.exports.observe(machine.focus)

    assert.equal(machine.exports.observe(found), found)
    assert.equal(machine.exports.observe(machine.exports.observe(found)), found)
  })

  test('the module is self-contained: source names round-trip', async () => {
    const machine = await loadMachine(program('a'))

    assert.deepEqual([...machine.authoredLegend.values()], ['a', 'I'])
    assert.deepEqual([...machine.legend], [...machine.authoredLegend])
  })

  test('every program is the same machine', () => {
    const emitGraph = compiled => {
      const graphImage = image(compiled.graph)
      return emit({
        ...graphImage,
        legend: addressLegend(graphImage, compiled.legend)
      })
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
