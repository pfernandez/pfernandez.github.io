import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

describe('observe', () => {
  const emptyLeft = [[], 'a']
  const stable = ['a', 'b']

  test('preserves referential identity', () => {
    assert.deepStrictEqual(observe(stable), stable)
    assert.deepStrictEqual(observe([[], stable]), stable)
  })

  test('returns right when left is empty', () =>
    assert.strictEqual(observe(emptyLeft), 'a'))

  test('discards right when left is not empty', () =>
    assert.strictEqual(observe([emptyLeft, 'b']), 'a'))

  test('does not reduce the right branch', () => {
    const root = ['x', []]
    assert.deepStrictEqual(observe(root)[1], root[1])
  })

  test('returns the argument when no reduction occurs', () =>
    assert.deepStrictEqual(observe(stable), stable))
})

