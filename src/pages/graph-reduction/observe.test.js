import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

describe('observe', () => {
  test('obvservation preserves referential identity', () => {
    const pair = ['a', 'b']
    const nested = [[], pair]
    assert.equal(observe(pair), pair)
    assert.equal(observe(nested), pair)
  })

  test('returns right when left is empty', () =>
    assert.deepEqual(observe([[], 'a']), 'a'))

  test('discards right when left is not empty', () =>
    assert.equal(observe([[[], 'a'], 'b']), 'a'))

  test('does not reduce the right branch', () => {
    const root = ['x', []]
    assert.equal(observe(root)[1], root[1])
  })

  test('returns pair when no reduction occurs', () => {
    const pair = ['a', 'b']
    const observation = observe(pair)
    assert.equal(observation, pair)
    assert.deepEqual(observation, ['a', 'b'])
  })
})

