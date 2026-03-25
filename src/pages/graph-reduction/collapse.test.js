import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { collapse } from './collapse.js'

describe('collapse', () => {
  test('collapses the leftmost-outermost redex', () => {
    assert.deepEqual(collapse([[[], 'a'], 'b']), ['a', 'b'])
    assert.deepEqual(collapse([[], ['a', 'b']]), ['a', 'b'])
  })

  test('returns irreducible pairs unchanged by reference', () => {
    const leaf = 'x'
    const empty = []
    const pair = ['a', 'b']

    assert.equal(collapse(leaf), leaf)
    assert.equal(collapse(empty), empty)
    assert.equal(collapse(pair), pair)
  })

  test('preserves untouched branches by reference', () => {
    const right = ['keep', 'me']
    const root = [[[[], 'a'], 'b'], right]
    const after = collapse(root)

    assert.deepEqual(after, [['a', 'b'], right])
    assert.equal(after[1], right)
  })

  test('does not reduce the right branch before the left exposes it', () => {
    const left = ['stay', 'put']
    const root = [left, [[], 'x']]
    const after = collapse(root)

    assert.equal(after, root)
    assert.deepEqual(after, root)
  })

  test('emits one local collapse event', () => {
    let event = null
    const after = collapse([[[], 'a'], 'b'], detail => {
      event = detail
    })

    assert.deepEqual(after, ['a', 'b'])
    assert.deepEqual(event,
                     { path: 'root0',
                       before: [[], 'a'],
                       after: 'a' })
  })
})
