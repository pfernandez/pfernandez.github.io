import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, observe, select, serialize } from './graph.js'
import { image, imageSerialize, observe as walk, select as pick } from './image.js'
import { emit, readLegend, sections } from './wasm.js'

const step = node => select(observe(node))

const repeat = (form, fn, n) =>
  n === 0 ? form : repeat(fn(form), fn, n - 1)

const definitions = `(I (x x))
(K ((x x) y))
(S (((((x z) (y z)) x) y) z))
(B ((((f (g x)) f) g) x))
(C ((((f y x) f) x) y))
(W (((f x x) f) x))
(M ((x x) x))
(Y ((f (Y f)) f))
(Loop (((step state (Loop step)) step) state))
(Yield (((continue state) state) continue))
(True ((x x) y))
(False ((y x) y))
(If ((((p x y) p) x) y))
(Not ((p False True) p))
(And (((p q False) p) q))
(Or (((p True q) p) q))
(Pair ((((f x y) x) y) f))
(First ((p K) p))
(Second ((p False) p))`

const programs = [
  '(I a)', '(K a b)', '(K a)', '(K a b c)', '(K 7 b)', '(K () b)',
  '(S f g x)', '(S K K a)', '(B f g x)', '(C f x y)', '(W f x)', '(M x)',
  '(Y f)', '(True a b)', '(False a b)', '(If p a b)',
  '(Pair a b f)', '(First p)', '(Second p)',
  '(let x y)', '(Loop Yield seed)']

const program = focus => compile(`${definitions}\n${focus}`)

const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const machine = async graph => {
  const record = image(graph)
  const bytes = emit(record)
  const { instance } = await WebAssembly.instantiate(bytes)

  return { focus: record.focus,
           authored: record.legend,
           legend: readLegend(bytes),
           memory: new DataView(instance.exports.memory.buffer),
           exports: instance.exports,
           bytes }
}

describe('the image is the graph', () => {
  test('images serialize identically to graphs', () => {
    for (const focus of programs) {
      const graph = program(focus)
      const { bytes, focus: root, legend } = image(graph)

      assert.equal(imageSerialize(view(bytes), root, legend), serialize(graph))
    }
  })

  test('the image walker agrees with the graph engine, step for step', () => {
    for (const focus of programs) {
      const graph = program(focus)
      const { bytes, focus: root, legend } = image(graph)
      const v = view(bytes)
      const found = walk(v, root)

      assert.equal(imageSerialize(v, found, legend), serialize(observe(graph)))
      assert.equal(imageSerialize(v, pick(v, found), legend), serialize(step(graph)))
    }
  })

  test('atoms are their own address, twice', () => {
    const { bytes, legend } = image(program('(K a b)'))
    const v = view(bytes)

    assert.ok(legend.size >= 2)
    for (const addr of legend.keys()) {
      assert.equal(v.getUint32(addr, true), addr)
      assert.equal(v.getUint32(addr + 4, true), addr)
    }
  })
})

describe('the machine runs the record', () => {
  test('the wasm engine computes every core form', async () => {
    for (const focus of programs) {
      const graph = program(focus)
      const m = await machine(graph)
      const found = m.exports.observe(m.exports.focus.value)
      const payload = m.exports.select(found)

      assert.equal(m.exports.focus.value, m.focus)
      assert.equal(imageSerialize(m.memory, payload, m.legend), serialize(step(graph)))
    }
  })

  test('observation is idempotent inside the machine', async () => {
    const m = await machine(program('(I a)'))
    const found = m.exports.observe(m.focus)

    assert.equal(m.exports.observe(found), found)
    assert.equal(m.exports.observe(m.exports.observe(found)), found)
  })

  test('composed reductions step through answers', async () => {
    const graph = program('(S K K a)')
    const m = await machine(graph)
    const stepped = p => m.exports.select(m.exports.observe(p))

    assert.equal(
      imageSerialize(m.memory, repeat(m.focus, stepped, 2), m.legend),
      serialize(repeat(graph, step, 2)))
  })

  test('Loop orbits with period 2, by address', async () => {
    const m = await machine(program('(Loop Yield seed)'))
    const stepped = p => m.exports.select(m.exports.observe(p))
    const yielded = stepped(m.focus)

    assert.notEqual(yielded, m.focus)
    assert.equal(repeat(m.focus, stepped, 2), m.focus)
    assert.equal(repeat(m.focus, stepped, 3), yielded)
    assert.equal(repeat(m.focus, stepped, 4), m.focus)
  })

  test('the module is self-contained: the legend round-trips', async () => {
    const m = await machine(program('(K 7 b)'))

    assert.deepEqual([...m.legend], [...m.authored])
  })

  test('every program is the same machine', () => {
    const a = sections(emit(image(program('(I a)'))))
    const b = sections(emit(image(program('(Loop Yield seed)'))))
    const body = (list, id) => Buffer.from(list.find(s => s.id === id).body).toString('hex')

    for (const id of [1, 3, 5, 6, 7, 10]) assert.equal(body(a, id), body(b, id))
    for (const id of [0, 11]) assert.notEqual(body(a, id), body(b, id))
  })
})
