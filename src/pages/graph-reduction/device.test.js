import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'

test('selects a prelinked view through a browser event', () => {
  const source = readFileSync(new URL('./dashboard.lisp', import.meta.url),
                              'utf-8')
  const button = view(source)

  assert.equal(button[0], 'button')
  assert.equal(button[2], 'Next')
  assert.equal(typeof button[1].onclick, 'function')
  assert.deepEqual(button[1].onclick(), ['h2', {}, 'Graph Reduction'])
})
