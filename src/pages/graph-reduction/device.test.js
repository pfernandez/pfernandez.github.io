import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'

test('renders a Lisp element through the wasm device boundary', () => {
  const source = readFileSync(new URL('./dashboard.lisp', import.meta.url),
                              'utf-8')

  assert.deepEqual(
    view(source),
    ['h2', {}, 'Graph Reduction'])
})
