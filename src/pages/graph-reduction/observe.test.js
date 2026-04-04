import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { observe } from './observe.js'

describe('observe', () => {
  test('returns the whole-term result and the reduced path', () => {
    const observation = observe([[[], 'a'], 'b'])

    assert.deepEqual(observation.after, ['a', 'b'])
    assert.deepEqual(observation.event,
                     { path: 'root0',
                       before: [[[], 'a'], 'b'],
                       after: ['a', 'b'] })
    assert.equal(observation.changed, true)
  })

  test('takes the leftmost-outermost collapse step', () => {
    assert.deepEqual(observe([[[], 'a'], 'b']).after, ['a', 'b'])
    assert.deepEqual(observe([[], ['a', 'b']]).after, ['a', 'b'])
  })

  test('reuses untouched branches by reference', () => {
    const right = ['keep', 'me']
    const root = [[[[], 'a'], 'b'], right]
    const observation = observe(root)

    assert.deepEqual(observation.after, [['a', 'b'], right])
    assert.equal(observation.after[1], right)
  })

  test('does not reduce the right branch before the left branch', () => {
    const left = ['stay', 'put']
    const root = [left, [[], 'x']]
    const observation = observe(root)

    assert.equal(observation.after, root)
    assert.deepEqual(observation.after, root)
  })

  test('returns no event when no collapse occurs', () => {
    const observation = observe(['a', 'b'])

    assert.equal(observation.changed, false)
    assert.equal(observation.event, null)
    assert.deepEqual(observation.after, ['a', 'b'])
  })
})
