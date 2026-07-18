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

const legends = new WeakMap()

const remember = (node, legend, seen = new Set()) => {
  if (!Array.isArray(node) || seen.has(node)) return
  seen.add(node)
  legends.set(node, legend)
  remember(node[0], legend, seen)
  remember(node[1], legend, seen)
}

const step = node => {
  const next = observe(node)[1]
  const legend = legends.get(node)
  if (legend) remember(next, legend)
  return next
}

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

const program = form => {
  const { graph, legend } = compile(`${definitions}\n${form}`)
  remember(graph, legend)
  return graph
}

const print = node =>
  serialize(node, { legend: legends.get(node) ?? [] })

const view = bytes =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

const loadMachine = async graph => {
  const graphImage = image(graph)
  const authoredLegend = imageLegend(graphImage, legends.get(graph))
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
      const legend = imageLegend(graphImage, legends.get(graph))
      const v = view(bytes)
      const found = observeAddress(v, root)

      assert.equal(
        serializeWasm(v, found, { legend }),
        print(observe(graph)))
      assert.equal(
        serializeWasm(v, selectAddress(v, found), { legend }),
        print(step(graph)))
    }
  })

  test('atoms are their own address, twice', () => {
    const graph = program('(K a b)')
    const graphImage = image(graph)
    const { bytes } = graphImage
    const legend = imageLegend(graphImage, legends.get(graph))
    const v = view(bytes)

    let atoms = 0
    for (const addr of legend.keys()) {
      if (v.getUint32(addr, true) !== addr) continue
      atoms += 1
      assert.equal(v.getUint32(addr, true), addr)
      assert.equal(v.getUint32(addr + 4, true), addr)
    }
    assert.ok(atoms >= 2)
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
        print(step(graph)))
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
      print(repeat(graph, step, 2)))
  })

  test('structural recursion replays to the same atom', async () => {
    const graph = program('(Last (Cons a (Cons b Nil)))')
    const machine = await loadMachine(graph)
    const stepped = p => machine.exports.select(machine.exports.observe(p))
    const result = repeat(machine.focus, stepped, 6)

    assert.equal(
      machine.legend.get(result),
      print(repeat(graph, step, 6)))
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
      return emit({
        ...graphImage,
        legend: imageLegend(graphImage, legends.get(graph))
      })
    }
    const a = sections(emitGraph(program('(I a)')))
    const b = sections(emitGraph(program('(Loop Yield seed)')))
    const body = (list, id) =>
      Buffer.from(list.find(section => section.id === id).body).toString('hex')

    for (const id of [1, 3, 5, 6, 7, 10]) assert.equal(body(a, id), body(b, id))
    for (const id of [0, 11]) assert.notEqual(body(a, id), body(b, id))
  })
})
