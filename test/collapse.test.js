import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { collapse, traceCollapse } from '../src/pages/graph-reduction/collapse/index.js'

describe('collapse reducer', () => {
  test('collapses the leftmost-outermost redex', () => {
    assert.deepEqual(collapse([[[], 'a'], 'b']), ['a', 'b'])
    assert.deepEqual(collapse([[], ['a', 'b']]), ['a', 'b'])
  })

  test('returns irreducible terms unchanged by reference', () => {
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

  test('records descend, collapse, and return frames', () => {
    const trace = traceCollapse([[[], 'a'], 'b'])

    assert.equal(trace.changed, true)
    assert.deepEqual(trace.after, ['a', 'b'])
    assert.deepEqual(
      trace.frames.map(({ type, path, term }) => ({ type, path, term })),
      [{ type: 'descend', path: 'root0', term: [[[], 'a'], 'b'] },
       { type: 'collapse', path: 'root0', term: ['a', 'b'] },
       { type: 'return', path: 'root', term: ['a', 'b'] }])
  })

  test('rejects malformed non-binary arrays', () => {
    assert.throws(() => collapse(['a', 'b', 'c']), /empty or pairs/i)
  })
})
