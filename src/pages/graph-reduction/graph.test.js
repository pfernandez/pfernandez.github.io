import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { compile, observe, serialize } from './graph.js'

const repeat = (form, step, n) =>
  n === 0 ? form : repeat(step(form), step, n - 1)

const source = (definitions, focus) =>
  `${[definitions].flat().join('\n')}\n${focus}`

const assertReduction = (definitions, focus, result, steps = 1) =>
  assert.equal(
    serialize(repeat(compile(source(definitions, focus)), observe, steps)),
    result)

const assertLoop = graph => {
  const yielded = observe(graph)

  assert.notEqual(yielded, graph)
  assert.equal(repeat(graph, observe, 2), graph)
  assert.equal(repeat(graph, observe, 4), graph)
  assert.equal(repeat(graph, observe, 6), graph)
  assert.equal(repeat(graph, observe, 3), yielded)
  assert.equal(repeat(graph, observe, 5), yielded)
}

const coreDefinitions = [
  '(I (x x))',
  '(K (x x y))',
  '(S (((x z) (y z)) x y z))',
  '(B ((f (g x)) f g x))',
  '(C ((f y x) f x y))',
  '(W ((f x x) f x))',
  '(M ((x x) x))',
  '(Y ((f (Y f)) f))',
  '(Loop ((step state (Loop step)) step state))',
  '(Yield ((continue state) state continue))',
  '(True (x x y))',
  '(False (y x y))',
  '(If ((p x y) p x y))',
  '(Not ((p False True) p))',
  '(And ((p q False) p q))',
  '(Or ((p True q) p q))',
  '(Pair ((f x y) x y f))',
  '(First ((p K) p))',
  '(Second ((p False) p))'
]

describe('true-shape compiler contracts', () => {
  test('definition slots are scoped identity', () => {
    const Dup = compile(source('(Dup ((x x) x))', 'Dup'))
    const x = Dup[1]

    assert.equal(Dup[0][0], x)
    assert.equal(Dup[0][1], x)
    assert.equal(x[0], x)
    assert.equal(x[1], Dup)
    assert.equal(serialize(observe(compile(source('(Dup ((x x) x))', '(Dup a)')))), '(a a)')
  })

  test('bound heads are applications instead of new definitions', () =>
    assertReduction('(A (x x))', '(A y)', 'y'))

  test('later definitions tie earlier applications in bodies', () => {
    const graph = compile(source(
      ['(I (x x))', '(Use ((I y) y))'],
      '(Use a)'))
    const expanded = observe(graph)

    assert.equal(expanded[1], 'a')
    assert.equal(observe(expanded), 'a')
  })

  test('partial application does not create a stable redex', () => {
    const graph = compile(source('(K (x x y))', '(K a)'))

    assert.notEqual(graph[0], graph)
    assert.equal(graph[1], 'a')
  })

  test('extra arguments remain after the filled body', () =>
    assertReduction('(K (x x y))', '(K a b c)', '(a c)'))

  test('flat source lists step to their head when no redex was built', () => {
    const graph = compile('(let x y)')

    assert.equal(serialize(graph), '(let x y)')
    assert.equal(observe(graph), 'let')
  })

  test('compile rejects malformed definitions', () => {
    assert.throws(
      () => compile('(I (x))'),
      /Definitions need a body and at least one slot/)

    assert.throws(
      () => compile('(K (x x x))'),
      /Definition slots must be unique/)

    assert.throws(
      () => compile(''),
      /Missing expression/)
  })

  test('serialize names repeated paths and cycles', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    assert.equal(serialize(root), '($ ((a b) $.1.0))')
  })
})

describe('core forms', () => {
  test('I returns its argument', () =>
    assertReduction('(I (x x))', '(I a)', 'a'))

  test('K returns its first argument', () =>
    assertReduction('(K (x x y))', '(K a b)', 'a'))

  test('S substitutes through both branches', () =>
    assertReduction(
      '(S (((x z) (y z)) x y z))',
      '(S f g x)',
      '((f x) (g x))'))

  test('S can be written as a pair spine', () => {
    const definition = '(S (((((x z) (y z)) x) y) z))'

    assertReduction(definition, '(S f g x)', '((f x) (g x))')
    assert.equal(
      serialize(observe(compile(source(definition, '(S f g x)'),
                                { output: 'spine' }))),
      '((f x) (g x))')
  })

  test('composed reductions are tied by default', () =>
    assertReduction(coreDefinitions, '(S K K a)', 'a', 2))

  test('B composes functions', () =>
    assertReduction(coreDefinitions, '(B f g x)', '(f (g x))'))

  test('C exchanges arguments', () =>
    assertReduction(coreDefinitions, '(C f x y)', '(f y x)'))

  test('W duplicates one argument', () =>
    assertReduction(coreDefinitions, '(W f x)', '(f x x)'))

  test('M applies its argument to itself', () =>
    assertReduction(coreDefinitions, '(M x)', '(x x)'))

  test('Y keeps a named self-reference', () => {
    const graph = compile(source(coreDefinitions, '(Y f)'))
    const result = observe(graph)
    const Y = graph[0]

    assert.equal(result[0], 'f')
    assert.equal(result[1], graph)
    assert.equal(graph[1], 'f')
    assert.equal(Y[0], Y)
    assert.equal(Y[1], result)
  })

  test('True returns its first branch', () =>
    assertReduction(coreDefinitions, '(True a b)', 'a'))

  test('False returns its second branch', () =>
    assertReduction(coreDefinitions, '(False a b)', 'b'))

  test('If applies the predicate to both branches', () =>
    assertReduction(coreDefinitions, '(If p a b)', '(p a b)'))

  test('Pair sends both values to a receiver', () =>
    assertReduction(coreDefinitions, '(Pair a b f)', '(f a b)'))

  test('First asks a pair to send values to K', () => {
    const result = observe(compile(source(coreDefinitions, '(First p)')))
    const K = result[1]

    assert.equal(result[0], 'p')
    assert.equal(K[1][1], K)
    assert.equal(K[2][1], K)
  })

  test('Second asks a pair to send values to False', () => {
    const result = observe(compile(source(coreDefinitions, '(Second p)')))
    const False = result[1]

    assert.equal(result[0], 'p')
    assert.equal(False[1][1], False)
    assert.equal(False[2][1], False)
  })

  test('core.lisp preserves authored source shape', () => {
    const core = readFileSync(new URL('./core.lisp', import.meta.url), 'utf8')

    assert.equal(serialize(observe(compile(core))), '((a c) (b c))')
  })

  test('Loop continues through a yielded continuation', () => {
    const graph = compile(source([
      '(Loop ((step state (Loop step)) step state))',
      '(Yield ((continue state) state continue))'
    ], '(Loop Yield seed)'))

    assertLoop(graph)
  })
})
