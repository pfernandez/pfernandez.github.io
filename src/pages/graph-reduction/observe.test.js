import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { observe } from './observe.js'

describe('observe', () => {
  test('lifts the local event to the whole step', () => {
    const observation = observe([[[], 'a'], 'b'])

    assert.deepEqual(observation.after, ['a', 'b'])
    assert.deepEqual(observation.event,
                     { path: 'root0',
                       before: [[[], 'a'], 'b'],
                       after: ['a', 'b'] })
    assert.equal(observation.changed, true)
  })

  test('reports no event when no collapse is available', () => {
    const observation = observe(['a', 'b'])

    assert.equal(observation.changed, false)
    assert.equal(observation.event, null)
    assert.deepEqual(observation.after, ['a', 'b'])
  })
})
