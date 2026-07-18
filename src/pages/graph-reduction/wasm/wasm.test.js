import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  observe,
  serialize,
  serializeWasm
} from '../graph/index.js'
import { imageLegend } from '../graph/serialize.js'
import { image } from './image.js'
import {
  emit,
  observeAddress,
  readLegend,
  sections,
  selectAddress
} from './wasm.js'

const step = node => observe(node)[1]

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
(Second ((p False) p))
(Nil ((n n) c))
(Cons (((((c h t) h) t) n) c))
(LastGo (((t h LastGo) h) t))
(Last ((l no LastGo) l))`

const forms = [
  '(I a)', '(K a b)', '(K a)', '(K a b c)', '(K 7 b)', '(K () b)',
  '(S f g x)', '(S K K a)', '(B f g x)', '(C f x y)', '(W f x)', '(M x)',
  '(Y f)', '(True a b)', '(False a b)', '(If p a b)',
  '(Pair a b f)', '(First p)', '(Second p)',
  '(let x y)', '(Loop Yield seed)']

const program = form => compile(`${definitions}\n${form}`)

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
  test('image observation agrees with the graph engine, step for step', () => {
    for (const form of forms) {
      const graph = program(form)
      const graphImage = image(graph)
      const { bytes, focus: root } = graphImage
      const legend = imageLegend(graphImage)
      const v = view(bytes)
      const found = observeAddress(v, root)

      assert.equal(
        serializeWasm(v, found, { legend }),
        serialize(observe(graph)))
      assert.equal(
        serializeWasm(v, selectAddress(v, found), { legend }),
        serialize(step(graph)))
    }
  })

  test('atoms are their own address, twice', () => {
    const graphImage = image(program('(K a b)'))
    const { bytes } = graphImage
    const legend = imageLegend(graphImage)
    const v = view(bytes)

    assert.ok(legend.size >= 2)
    for (const addr of legend.keys()) {
      assert.equal(v.getUint32(addr, true), addr)
      assert.equal(v.getUint32(addr + 4, true), addr)
    }
  })
})

describe('the machine runs graph bytes', () => {
  test('the wasm engine computes every core form', async () => {
    for (const form of forms) {
      const graph = program(form)
      const machine = await loadMachine(graph)
      const found = machine.exports.observe(machine.exports.focus.value)
      const payload = machine.exports.select(found)

      assert.equal(machine.exports.focus.value, machine.focus)
      assert.equal(
        serializeWasm(machine.memory, payload, { legend: machine.legend }),
        serialize(step(graph)))
    }
  })

  test('observation is idempotent inside the machine', async () => {
    const machine = await loadMachine(program('(I a)'))
    const found = machine.exports.observe(machine.focus)

    assert.equal(machine.exports.observe(found), found)
    assert.equal(machine.exports.observe(machine.exports.observe(found)), found)
  })

  test('composed reductions step through answers', async () => {
    const graph = program('(S K K a)')
    const machine = await loadMachine(graph)
    const stepped = p => machine.exports.select(machine.exports.observe(p))

    assert.equal(
      serializeWasm(
        machine.memory,
        repeat(machine.focus, stepped, 2),
        { legend: machine.legend }),
      serialize(repeat(graph, step, 2)))
  })

  test('structural recursion replays to the same atom', async () => {
    const graph = program('(Last (Cons a (Cons b Nil)))')
    const machine = await loadMachine(graph)
    const stepped = p => machine.exports.select(machine.exports.observe(p))
    const result = repeat(machine.focus, stepped, 6)

    assert.equal(
      machine.legend.get(result),
      serialize(repeat(graph, step, 6)))
    assert.equal(machine.legend.get(result), 'b')
  })

  test('Loop orbits with period 2, by address', async () => {
    const machine = await loadMachine(program('(Loop Yield seed)'))
    const stepped = p => machine.exports.select(machine.exports.observe(p))
    const yielded = stepped(machine.focus)

    assert.notEqual(yielded, machine.focus)
    assert.equal(repeat(machine.focus, stepped, 2), machine.focus)
    assert.equal(repeat(machine.focus, stepped, 3), yielded)
    assert.equal(repeat(machine.focus, stepped, 4), machine.focus)
  })

  test('the module is self-contained: the legend round-trips', async () => {
    const machine = await loadMachine(program('(K 7 b)'))

    assert.deepEqual([...machine.legend], [...machine.authoredLegend])
  })

  test('every program is the same machine', () => {
    const emitGraph = graph => {
      const graphImage = image(graph)
      return emit({ ...graphImage, legend: imageLegend(graphImage) })
    }
    const a = sections(emitGraph(program('(I a)')))
    const b = sections(emitGraph(program('(Loop Yield seed)')))
    const body = (list, id) =>
      Buffer.from(list.find(section => section.id === id).body).toString('hex')

    for (const id of [1, 3, 5, 6, 7, 10]) assert.equal(body(a, id), body(b, id))
    for (const id of [0, 11]) assert.notEqual(body(a, id), body(b, id))
  })
})
