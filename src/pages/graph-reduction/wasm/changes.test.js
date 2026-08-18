import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changes } from './changes.js'

test('forwards consecutive identity changes', () => {
  const states = []
  const observe = changes(state => states.push(state))
  const traversed = [0, 0, 8, 8, 0]

  traversed.forEach(observe)

  assert.deepEqual(states, [0, 8, 0])
})

test('continues after an existing identity', () => {
  const states = []
  const observe = changes(state => states.push(state), 0)
  const traversed = [0, 8, 8, 0]

  traversed.forEach(observe)

  assert.deepEqual(states, [8, 0])
})
