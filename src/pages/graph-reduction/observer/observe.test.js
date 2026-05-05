import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

describe('observe', () => {
  test('atoms are stable', () => {
    assert.equal(observe('a'), 'a')
    assert.equal(observe(1), 1)
  })

  test('the empty boundary is stable', () => {
    const empty = []
    assert.equal(observe(empty), empty)
  })

  test('fixed pairs expose their payload', () => {
    const fixed = []
    fixed[0] = fixed
    fixed[1] = 'a'
    assert.equal(observe(fixed), 'a')
  })

  test('empty-headed pairs collapse to the right', () => {
    assert.equal(observe([[], 'a']), 'a')
  })
})
