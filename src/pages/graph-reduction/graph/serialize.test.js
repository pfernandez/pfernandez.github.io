import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from '../observer/observe.js'
import { compile, parse, serialize } from './index.js'

const parseTerm = source => parse(source)[0]
const hasGraph = value =>
  value && typeof value === 'object' && Object.hasOwn(value, 'graph')

const graphOf = value => hasGraph(value) ? value.graph : value
const sequenceOf = value => hasGraph(value) ? value.sequence : []
const witnessOf = value => hasGraph(value) ? value.witness ?? [] : []
const serializeState = value =>
  serialize(graphOf(value), sequenceOf(value), witnessOf(value))

describe('serialize', () => {
  test('serialize writes canonical atoms and pairs', () => {
    assert.equal(serialize('foo'), 'foo')
    assert.equal(serialize(42), '42')
    assert.equal(serialize([]), '()')
    assert.equal(serialize([[], 'x']), '(() x)')
    assert.equal(serialize([['a', 'b'], ['c', ['d', 'e']]]),
                 '((a b) (c (d e)))')
  })

  test('serialize round-trips parsed terms', () =>
    ['foo',
     '42',
     '()',
     '(a b)',
     '((() a) (() b))',
     '; comment\n((a b) ; inline\n (c d))'].forEach(source => {
      const pair = parseTerm(source)
      assert.deepEqual(parseTerm(serialize(pair)), pair)
    }))

  test('serialize rejects malformed arrays', () => {
    assert.throws(() => serialize(['a']), /empty or pairs/i)
    assert.throws(() => serialize(['a', 'b', 'c']), /empty or pairs/i)
  })

  test('serialize writes numeric templates', () =>
    assert.equal(serialize([[[[[0, 2], [1, 2]], 'a'], 'b'], 'c']),
                 '(((((0 2) (1 2)) a) b) c)'))

  test('witness chooses how to print an existing cycle', () => {
    const cycle = ['again', null]
    cycle[1] = cycle
    const graph = [[cycle, 'arg'], 'tail']

    assert.equal(serialize(graph), '(((again 0) arg) tail)')
    assert.equal(serialize(graph, [], [cycle]), '((0 arg) tail)')
  })

  test('sequence chooses the numeric argument order', () =>
    assert.equal(serializeState(compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)), '(((((0 2) (1 2)) a) b) c)'))

  test('shared arguments stay shared while S reduces', () => {
    const state = compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)
    const sequence = sequenceOf(state)
    const step0 = graphOf(state)
    const c = step0[0][1]
    const step1 = observe(step0)
    const step2 = observe(step1)
    const step3 = observe(step2)

    assert.equal(step0[1][1], c)
    assert.equal(step1[0][1], c)
    assert.equal(step1[1][1], c)
    assert.equal(step2[0][1], c)
    assert.equal(step2[1][1], c)
    assert.equal(step3, step2)
    assert.equal(serialize(step0, sequence), '(((((0 2) (1 2)) a) b) c)')
    assert.equal(serialize(step1, sequence), '((((a 1) (0 1)) b) c)')
    assert.equal(serialize(step2, sequence), '((a c) (b c))')
  })

  test('raw fixed points are numbered by traversal order', () => {
    const point = []
    point[0] = point
    point[1] = 'a'

    assert.equal(serialize(point), '0')
  })

  test('hidden graph points print their payloads inside projections', () => {
    const pairState = compile('(defn P (x y) (x y))\n((P a) b)')
    const innerState = compile('(defn I (x) x)\n(I q)')
    const innerEmptyState = compile('(defn I (x) x)\n(I ())')
    const pair = graphOf(pairState)
    const inner = graphOf(innerState)
    const innerEmpty = graphOf(innerEmptyState)
    const sequence = sequenceOf(pairState)
    const point = []
    point[0] = point
    point[1] = 'm'

    assert.equal(serialize([[pair[0], []], pair[1]], sequence),
                 '((((0 ()) 1) a) b)')
    assert.equal(serialize([[pair[0], inner], pair[1]], sequence),
                 '((((0 (0 q)) 1) a) b)')
    assert.equal(serialize([[pair[0], ['x', inner]], pair[1]], sequence),
                 '((((0 (x (0 q))) 1) a) b)')
    assert.equal(serialize([[pair[0], ['x', innerEmpty]], pair[1]], sequence),
                 '((((0 (x (0 ()))) 1) a) b)')
    assert.equal(serialize([[pair[0], point], pair[1]], sequence),
                 '((((0 (0 m)) 1) a) b)')
    assert.equal(serialize([inner, point], sequenceOf(innerState)),
                 '((0 (0 m)) q)')
    assert.equal(serialize([inner, []], sequenceOf(innerState)), '((0 ()) q)')
  })

  test('malformed arrays still fail inside projections', () => {
    const pairState = compile('(defn P (x y) (x y))\n((P a) b)')
    const innerState = compile('(defn I (x) x)\n(I q)')
    const filledState = compile('(defn I (x) x)\n(I (a b))')
    const pair = graphOf(pairState)
    const inner = graphOf(innerState)
    const filled = graphOf(filledState)
    const sequence = [
      ...sequenceOf(pairState),
      ...sequenceOf(innerState),
      ...sequenceOf(filledState)
    ]
    filled[1].pop()

    assert.throws(() => serialize([[pair[0], ['bad']], pair[1]], sequence),
                  /empty or pairs/i)
    assert.throws(() => serialize([inner, ['bad']], sequence),
                  /empty or pairs/i)
    assert.throws(() => serialize([[pair[0], ['x', filled]], pair[1]],
                                  sequence),
                  /empty or pairs/i)
  })

  test('graph points hidden behind atom heads print their payloads', () => {
    const empty = compile('(defn I (x) x)\n(x (I ()))')
    const malformed = compile('(defn I (x) x)\n(x (I (a b)))')

    assert.equal(serializeState(empty), '(x ())')
    graphOf(malformed)[1].pop()
    assert.throws(() => serializeState(malformed), /empty or pairs/i)
  })
})
