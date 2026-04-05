import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { collapse } from './collapse.js'

describe('collapse', () => {
  test('() is identity at the collapse layer', () => {
    assert.equal(collapse([[], 'x']), 'x')
    assert.deepEqual(collapse([[], ['a', 'b']]), ['a', 'b'])
  })

  test('returns non-redex terms unchanged by reference', () => {
    const leaf = 'x'
    const empty = []
    const pair = ['a', 'b']
    const nested = [[[], 'a'], 'b']

    assert.equal(collapse(leaf), leaf)
    assert.equal(collapse(empty), empty)
    assert.equal(collapse(pair), pair)
    assert.equal(collapse(nested), nested)
  })
})

