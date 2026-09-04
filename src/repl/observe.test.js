import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observe } from './observe.js'

test('walks to a fixed observation', () => {
  const b = []
  const c = []
  const application = [c, c]
  const focus = [b, application]
  b[0] = b[1] = b
  c[0] = c[1] = c

  assert.deepEqual(observe(focus), {
    focus: c,
    steps: [focus, application, c]
  })
})

test('stops when a longer orbit returns to its origin', () => {
  const a = []
  const b = []
  const c = []
  a[0] = a
  a[1] = b
  b[0] = b
  b[1] = c
  c[0] = c
  c[1] = a

  assert.deepEqual(observe(a), {
    focus: a,
    steps: [a, b, c, a]
  })
})
