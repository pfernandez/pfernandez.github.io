import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  addressLegend,
  link,
  serialize,
  serializeWasm
} from '../graph/index.js'
import { step } from '../graph/index.js'
import { stepAddress } from './address.js'
import { image } from './image.js'
import { emit, readLegend, sections } from './wasm.js'

const source = arg =>
  `((P x) (P ${arg}))`

const program = arg =>
  link(source(arg))

const view = bytes =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const loadMachine = async linked => {
  const graphImage = image(linked.graph, linked.focus)
  const authoredLegend = addressLegend(graphImage)
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
  test('image step agrees with the graph engine', () => {
    const linked = program('a')
    const graphImage = image(linked.graph, linked.focus)
    const { bytes, focus } = graphImage
    const legend = addressLegend(graphImage)
    const memory = view(bytes)
    const found = stepAddress(memory, focus)

    assert.equal(
      serializeWasm(memory, found, { legend }),
      serialize(step(linked.focus)))
  })

  test('source identities retain their links', () => {
    const linked = program('a')
    const graphImage = image(linked.graph, linked.focus)
    const { bytes } = graphImage
    const legend = addressLegend(graphImage)
    const memory = view(bytes)
    const address = name =>
      [...legend].find(([, entry]) => entry === name)[0]
    const a = address('a')
    const x = address('x')
    const P = address('P')

    assert.equal(memory.getUint32(a, true), a)
    assert.equal(memory.getUint32(a + 4, true), a)
    assert.equal(memory.getUint32(P, true), P)
    assert.equal(memory.getUint32(P + 4, true), x)
  })
})

describe('the machine runs graph bytes', () => {
  test('the wasm engine steps the source graph', async () => {
    const linked = program('a')
    const machine = await loadMachine(linked)
    const result = machine.exports.step(machine.exports.focus.value)

    assert.equal(machine.exports.focus.value, machine.focus)
    assert.equal(
      serializeWasm(machine.memory, result, { legend: machine.legend }),
      serialize(step(linked.focus)))
  })

  test('results are idempotent inside the machine', async () => {
    const machine = await loadMachine(program('a'))
    const found = machine.exports.step(machine.focus)

    assert.equal(machine.exports.step(found), found)
    assert.equal(machine.exports.step(machine.exports.step(found)), found)
  })

  test('the module is self-contained: source names round-trip', async () => {
    const machine = await loadMachine(program('a'))

    assert.deepEqual(
      [...machine.authoredLegend.values()],
      ['P', 'x', 'a'])
    assert.deepEqual([...machine.legend], [...machine.authoredLegend])
  })

  test('every program is the same machine', () => {
    const emitGraph = linked => {
      const graphImage = image(linked.graph, linked.focus)
      return emit({
        ...graphImage,
        legend: addressLegend(graphImage)
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
