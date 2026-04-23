import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

const fixed = value => {
  const pair = []
  pair[0] = pair
  pair[1] = value
  return pair
}

const reduce = (term, remaining = 16) => {
  const observed = observe(term)
  if (observed === term) return term
  if (remaining <= 0) throw new Error('Did not settle')
  return reduce(observed, remaining - 1)
}

describe('observe', () => {
  test('atoms are stable', () =>
    assert.equal(observe('a'), 'a'))

  test('the empty boundary is stable', () => {
    const empty = []
    assert.equal(observe(empty), empty)
  })

  test('malformed arrays are stable', () => {
    const malformed = [[[], []]]
    const unary = ['x']

    assert.equal(observe(malformed), malformed)
    assert.equal(observe(unary), unary)
  })

  test('fixed pairs expose their payload', () =>
    assert.equal(observe(fixed('a')), 'a'))

  test('empty-headed pairs collapse to the right', () => {
    assert.deepEqual(observe([[], []]), [])
    assert.equal(observe([[], 'a']), 'a')
  })

  test('pair focus starts on the left', () =>
    assert.deepEqual(observe([[[], []], 'a']), [[], 'a']))

  test('pair focus shifts right after a stable pair head', () =>
    assert.deepEqual(observe([['a', 'b'], fixed('c')]),
                     [['a', 'b'], 'c']))

  test('atom-headed pairs hide their right branch', () => {
    const root = ['a', fixed('b')]
    assert.equal(observe(root), root)
  })

  test('stable pairs keep their identity', () => {
    const stable = ['a', 'b']
    assert.equal(observe(stable), stable)
  })
})

describe('shared continuations', () => {
  test('S observes three argument events in order', () => {
    // S uses one primitive kind of delayed identity, instantiated as three
    // argument events. The third event is shared by graph identity.
    const p0 = fixed('a')
    const p1 = fixed('b')
    const p2 = fixed('c')
    const s = [[p0, p2], [p1, p2]]

    const step0 = observe(s)
    assert.deepEqual(step0, [['a', p2], [p1, p2]])
    assert.equal(step0[0][1], p2)
    assert.equal(step0[1][1], p2)

    const step1 = observe(step0)
    assert.deepEqual(step1, [['a', p2], ['b', p2]])
    assert.equal(step1[0][1], p2)
    assert.equal(step1[1][1], p2)

    const step2 = observe(step1)
    assert.deepEqual(step2, [['a', 'c'], ['b', 'c']])
  })

  test('one fixed object represents one event', () => {
    // Reusing one object gives one event, not three argument slots. This is
    // why S needs distinct event vertices even when they share one primitive.
    const point = fixed('a')

    assert.deepEqual(reduce([[point, point], [point, point]]),
                     [['a', 'a'], ['a', 'a']])
  })

  test('duplicated labels do not create shared events', () => {
    // The 2D tree shape can duplicate a label, but it cannot express that both
    // branches point to one future event. The extra dimension is graph identity.
    const sharedC = fixed('c')
    const shared = [['a', sharedC], ['b', sharedC]]
    const copied = [['a', fixed('c')], ['b', fixed('c')]]

    assert.deepEqual(observe(shared), [['a', 'c'], ['b', 'c']])
    assert.equal(observe(copied), copied)
  })

  test('shared continuations project one observed payload', () => {
    const payload = ['c', 'd']
    const sharedC = fixed(payload)
    const observed = observe([['a', sharedC], ['b', sharedC]])

    assert.equal(observed[0][1], payload)
    assert.equal(observed[1][1], payload)
  })
})
