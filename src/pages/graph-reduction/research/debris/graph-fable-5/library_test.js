import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { compile, observe, select, serialize } from './graph.js'
import { image } from './image.js'
import { emit, readLegend } from './wasm.js'

const step = node => select(observe(node))

const settle = (node, cap = 64) => {
  while (cap--) {
    const next = step(node)
    if (next === node) return node
    node = next
  }
  throw new Error('did not settle')
}

const library = readFileSync(new URL('./library.lisp', import.meta.url), 'utf8')
  .split('\n')
  .filter(line => !line.startsWith('(Last (Cons'))
  .join('\n')

const program = focus => compile(`${library}\n${focus}`)

const picture = focus => serialize(settle(program(focus)))

const succ = picture('Succ')
const zero = picture('Zero')

const nat = (node, cap = 64) => {
  while (cap--) {
    if (Array.isArray(node) && serialize(node[0]) === succ) return 1 + nat(node[1])
    if (serialize(node) === zero) return 0
    node = step(node)
  }
  throw new Error('not a numeral')
}

describe('the library idiom', () => {
  test('values settle at their constructor', () => {
    assert.equal(picture('(Cons a Nil)'), picture('Cons'))
    assert.equal(picture('(Succ Zero)'), picture('Succ'))
  })

  test('case analysis completes the partial', () =>
    assert.equal(picture('(Head (Cons a (Cons b Nil)))'), 'a'))

  test('structural recursion settles on closed data', () =>
    assert.equal(picture('(Last (Cons a (Cons b Nil)))'), 'b'))

  test('arithmetic computes at compile time', () => {
    assert.equal(nat(program('(Add (Succ Zero) (Succ Zero))')), 2)
    assert.equal(nat(program('(Add (Succ (Succ Zero)) (Succ Zero))')), 3)
    assert.equal(nat(program('(Mul (Succ (Succ Zero)) (Succ (Succ Zero)))')), 4)
    assert.equal(nat(program('(Length (Cons a (Cons b Nil)))')), 2)
  })

  test('open data compiles to a total symbolic residual', () => {
    const graph = program('(Add m (Succ Zero))')

    assert.match(serialize(step(graph)), /^\(\(m /)
    assert.throws(() => nat(graph), /not a numeral/)
  })

  test('the knot makes infinite data finite, consumed fused', () => {
    assert.equal(picture('(Repeat a no K)'), 'a')
    assert.equal(picture('(Repeat a)'), picture('Cons'))
  })

  test('the library file itself settles', () =>
    assert.equal(serialize(settle(compile(readFileSync(
      new URL('./library.lisp', import.meta.url), 'utf8')))), 'b'))
})

describe('the walls', () => {
  test('a computed answer in head position is inert', () => {
    assert.equal(picture('(App I a)'), 'a')
    assert.notEqual(picture('(App (I I) a)'), 'a')
  })

  test('forward references do not bind', () =>
    assert.equal(
      serialize(settle(compile('(A ((B x) x))\n(B (y y))\n(A k)'))),
      'B'))
})

describe('the machine replays the library', () => {
  test('structural recursion settles to the same atom in wasm', async () => {
    const graph = program('(Last (Cons a (Cons b Nil)))')
    const bytes = emit(image(graph))
    const { instance } = await WebAssembly.instantiate(bytes)
    const { focus } = instance.exports
    const stepped = p => instance.exports.select(instance.exports.observe(p))

    let p = focus.value
    let cap = 64
    while (cap-- && stepped(p) !== p) p = stepped(p)

    assert.equal(readLegend(bytes).get(p), serialize(settle(graph)))
    assert.equal(readLegend(bytes).get(p), 'b')
  })
})
