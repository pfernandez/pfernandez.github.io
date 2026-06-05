import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, observe, serialize } from './graph.js'

const repeat = (form, step, n) =>
  n === 0 ? form : repeat(step(form), step, n - 1)

const history = (definitions, focus) =>
  [definitions].flat().reduceRight(
    (after, definition) => `(${definition} ${after})`,
    `(() ${focus})`)

const assertForm = (definitions, focus, connected, result, steps = 1) => {
  const graph = compile(history(definitions, focus))
  assert.equal(serialize(graph), connected)
  assert.equal(serialize(repeat(graph, observe, steps)), result)
}

describe('compiler contracts', () => {
  test('compile connects labels by identity', () => {
    const dup = compile(history('((Dup x) (x x))', 'Dup'))
    const x = dup[0][0]

    assert.equal(x[1], dup)
    assert.equal(dup[1][0], x)
    assert.equal(dup[1][1], x)

    const use = compile(history(['((I x) x)', '((Use y) (I y))'], 'Use'))
    const I = use[1][0]
    const y = use[0][0]

    assert.equal(use[1][1], y)
    assert.equal(I[0][0][1], I)
  })

  test('serialize names repeated paths and cycles', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    assert.equal(serialize(root), '($ ((a b) $.1.0))')
  })

  test('observe stops at the first locally stable pair', () => {
    const stable = []
    stable[0] = stable
    stable[1] = 'result'

    assert.equal(observe([[stable, 'ignored'], 'tail']), 'result')
  })

  test('stable atoms can be pure structure', () => {
    const a = []
    a[0] = a
    a[1] = a

    const fix = []
    fix[0] = fix
    fix[1] = a

    const graph = [[fix, a], a]

    assert.equal(serialize(a), '($ $)')
    assert.equal(observe(a), a)
    assert.equal(graph[0][0][1], a)
    assert.equal(graph[0][1], a)
    assert.equal(graph[1], a)
    assert.equal(observe(graph), a)
    assert.equal(observe(observe(graph)), a)
  })

  test('compile rejects source with no runtime form', () => {
    assert.throws(
      () => compile('()'),
      /Empty pairs only fix a following form/)

    assert.throws(
      () => compile('(I ())'),
      /Empty pairs only fix a following form/)
  })

  test('empty pair fixes the following form', () => {
    const fixed = compile('(() a)')
    const graph = compile('(((I x) x) (() (I a)))')

    assert.equal(serialize(fixed), '($ a)')
    assert.equal(serialize(observe(fixed)), 'a')
    assert.equal(serialize(graph), '(($.0 a) a)')
    assert.equal(serialize(observe(graph)), 'a')
  })

  test('let is an ordinary symbol', () => {
    const graph = compile('(let x y)')

    assert.equal(serialize(graph), '((let x) y)')
  })

  test('compile rejects nullary definitions', () =>
    assert.throws(
      () => compile(history('((I) x)', 'I')),
      /Nullary definitions need a runtime identity node/))

  test('later definitions can use earlier names with local arguments', () =>
    assertForm(
      ['((I x) x)', '((Use y) (I y))'],
      '(Use a)',
      '(($.0 (($.0.1.0 a) a)) a)',
      'a',
      2))

  test('definitions can return definition-shaped output', () =>
    assertForm(
      '((A x) ((x x) x))',
      '(A a)',
      '(($.0 ((a a) a)) a)',
      '((a a) a)'))

  test('partial application stays connected without firing', () => {
    const graph = compile(history('((K x y) x)', '(K a)'))

    assert.notEqual(graph[0], graph)
    assert.equal(
      serialize(graph),
      [
        '(((($.0.0.0 $.0) ($.0.0.1 $.0))',
        '$.0.0.0) a)'
      ].join(' '))
  })
})

describe('core forms', () => {
  test('I links its argument to its body', () =>
    assertForm(
      '((I x) x)',
      '(I a)',
      '(($.0 a) a)',
      'a'))

  test('K links its first argument to its body', () =>
    assertForm(
      '((K x y) x)',
      '(K a b)',
      '((($.0.0 a) a) b)',
      'a'))

  test('S links substitution through both branches', () =>
    assertForm(
      '((S x y z) ((x z) (y z)))',
      '(S f g x)',
      '(((($.0.0.0 ((f x) (g x))) f) g) x)',
      '((f x) (g x))'))

  test('B links composed functions', () =>
    assertForm(
      '((B f g x) (f (g x)))',
      '(B f g x)',
      '(((($.0.0.0 (f (g x))) f) g) x)',
      '(f (g x))'))

  test('C links exchanged arguments', () =>
    assertForm(
      '((C f x y) (f y x))',
      '(C f x y)',
      '(((($.0.0.0 ((f y) x)) f) x) y)',
      '((f y) x)'))

  test('W links one argument to both occurrences', () =>
    assertForm(
      '((W f x) (f x x))',
      '(W f x)',
      '((($.0.0 ((f x) x)) f) x)',
      '((f x) x)'))

  test('M links self-application', () =>
    assertForm(
      '((M x) (x x))',
      '(M x)',
      '(($.0 (x x)) x)',
      '(x x)'))

  test('Y links a named self-reference', () =>
    assertForm(
      '((Y f) (f (Y f)))',
      '(Y f)',
      '(($.0 (f $)) f)',
      '(f (($.1.0 $) f))'))

  test('Loop links state with a continuation', () =>
    assertForm(
      '((Loop step state) (step state (Loop step)))',
      '(Loop step state)',
      [
        '((($.0.0 ((step state)',
        '(((($.0.0.1.1.0.0.0 $.0.0.1.1.0)',
        '($.0.0.1.1.0.0.1 $.0.0.1.1.0))',
        '(($.0.0.1.1.0.0.0 $.0.0.1.1.0.0.1)',
        '($.0.0.1.1.0 $.0.0.1.1.0.0.0)))',
        'step))) step) state)'
      ].join(' '),
      [
        '((step state)',
        '(((($.1.0.0.0 $.1.0) ($.1.0.0.1 $.1.0))',
        '(($.1.0.0.0 $.1.0.0.1) ($.1.0 $.1.0.0.0)))',
        'step))'
      ].join(' ')))

  test('Loop continues through a yielded continuation', () => {
    const graph = compile(history([
      '((Loop step state) (step state (Loop step)))',
      '((Yield state continue) (continue state))'
    ], '(Loop Yield seed)'))
    const yielded = observe(graph)

    assert.notEqual(yielded, graph)
    assert.equal(repeat(graph, observe, 2), graph)
    assert.equal(repeat(graph, observe, 4), graph)
    assert.equal(repeat(graph, observe, 6), graph)
    assert.equal(repeat(graph, observe, 3), yielded)
    assert.equal(repeat(graph, observe, 5), yielded)
  })

  test('Yield links a state to its continuation', () =>
    assertForm(
      '((Yield state continue) (continue state))',
      '(Yield state continue)',
      '((($.0.0 (continue state)) state) continue)',
      '(continue state)'))

  test('True links to its first branch', () =>
    assertForm(
      '((True x y) x)',
      '(True a b)',
      '((($.0.0 a) a) b)',
      'a'))

  test('False links to its second branch', () =>
    assertForm(
      '((False x y) y)',
      '(False a b)',
      '((($.0.0 b) a) b)',
      'b'))

  test('If links predicate selection', () =>
    assertForm(
      '((If p x y) (p x y))',
      '(If p a b)',
      '(((($.0.0.0 ((p a) b)) p) a) b)',
      '((p a) b)'))

  test('Not links its predicate to reversed branches', () =>
    assertForm(
      '((Not p) (p False True))',
      '(Not p)',
      '(($.0 ((p False) True)) p)',
      '((p False) True)'))

  test('And links its predicates with False as the fallback', () =>
    assertForm(
      '((And p q) (p q False))',
      '(And p q)',
      '((($.0.0 ((p q) False)) p) q)',
      '((p q) False)'))

  test('Or links its predicates with True as the fallback', () =>
    assertForm(
      '((Or p q) (p True q))',
      '(Or p q)',
      '((($.0.0 ((p True) q)) p) q)',
      '((p True) q)'))

  test('Pair links two values to a receiver', () =>
    assertForm(
      '((Pair x y f) (f x y))',
      '(Pair a b f)',
      '(((($.0.0.0 ((f a) b)) a) b) f)',
      '((f a) b)'))

  test('First links a pair to its first-value receiver', () =>
    assertForm(
      '((First p) (p K))',
      '(First p)',
      '(($.0 (p K)) p)',
      '(p K)'))

  test('Second links a pair to its second-value receiver', () =>
    assertForm(
      '((Second p) (p False))',
      '(Second p)',
      '(($.0 (p False)) p)',
      '(p False)'))
})
