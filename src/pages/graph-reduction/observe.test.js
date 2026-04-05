import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { observe } from './observe.js'

describe('observe', () => {
  test('The empty pair acts as identity', () => {
    const value = 'x'
    const pair = ['a', 'b']
    assert.equal(observe([[], value]), value)
    assert.equal(observe([[], pair]), pair)
    assert.deepEqual(observe([[], pair]), pair)
  })

  test('obvservation preserves referential identity', () => {
    const value = 'x'
    const empty = []
    const pair = ['a', 'b']
    const nested = [[[], 'a'], 'b']

    assert.equal(observe(value), value)
    assert.equal(observe(empty), empty)
    assert.equal(observe(pair), pair)
    assert.equal(observe(nested), nested)
  })

  test('takes the leftmost-outermost collapse step', () => {
    assert.deepEqual(observe([[[], 'a'], 'b']), ['a', 'b'])
    assert.deepEqual(observe([[], ['a', 'b']]), ['a', 'b'])
  })

  test('reuses untouched branches by reference', () => {
    const right = ['keep', 'me']
    const root = [[[[], 'a'], 'b'], right]
    const observation = observe(root)

    assert.deepEqual(observation, [['a', 'b'], right])
    assert.equal(observation, right)
  })

  test('does not reduce the right branch', () => {
    const left = ['stay', 'put']
    const root = [left, [[], 'x']]
    const observation = observe(root)

    assert.equal(observation, root)
    assert.deepEqual(observation, root)
  })

  test('returns the pair when no collapse occurs', () => {
    const pair = ['a', 'b']
    const observation = observe(pair)

    assert.equal(observation, pair)
    assert.deepEqual(observation, ['a', 'b'])
  })
})
