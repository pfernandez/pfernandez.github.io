import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

const fixed = value => {
  const pair = []
  pair[0] = pair
  pair[1] = value
  return pair
}

const reduce = (term, maxSteps = 16) => {
  let next = term

  for (let i = 0; i < maxSteps; i++) {
    const observed = observe(next)
    if (observed === next) return next
    next = observed
  }

  throw new Error(`Did not settle after ${maxSteps} steps`)
}

describe('observe', () => {
  test('leaves atoms alone', () =>
    assert.equal(observe('a'), 'a'))

  test('leaves the null boundary alone', () => {
    const empty = []
    assert.equal(observe(empty), empty)
  })

  test('fires a fixed point pair', () =>
    assert.equal(observe(fixed('a')), 'a'))

  test('collapses an empty-left boundary', () => {
    assert.deepEqual(observe([[], []]), [])
    assert.equal(observe([[], 'a']), 'a')
  })

  test('steps left before right', () =>
    assert.deepEqual(observe([[[], []], 'a']), [[], 'a']))

  test('shifts right once the left pair is stable', () =>
    assert.deepEqual(observe([['a', 'b'], fixed('c')]),
                     [['a', 'b'], 'c']))

  test('does not force the right branch of an atom-headed pair', () => {
    const root = ['a', fixed('b')]
    assert.equal(observe(root), root)
  })

  test('preserves stable pair identity', () => {
    const stable = ['a', 'b']
    assert.equal(observe(stable), stable)
  })
})

describe('fixed point motifs', () => {
  test('feeds S through a shared continuation', () => {
    const p0 = fixed('a')
    const p1 = fixed('b')
    const p2 = fixed('c')
    const s = [[p0, p2], [p1, p2]]

    const step0 = observe(s)
    assert.deepEqual(step0, [['a', p2], [p1, p2]])

    const step1 = observe(step0)
    assert.deepEqual(step1, [['a', p2], ['b', p2]])

    const step2 = observe(step1)
    assert.deepEqual(step2, [['a', 'c'], ['b', 'c']])
  })

  test('reduces S to its exposed shape', () => {
    const p0 = fixed('a')
    const p1 = fixed('b')
    const p2 = fixed('c')

    assert.deepEqual(reduce([[p0, p2], [p1, p2]]),
                     [['a', 'c'], ['b', 'c']])
  })
})
