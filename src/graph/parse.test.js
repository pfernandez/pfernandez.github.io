import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse } from './index.js'

test('returns the source tree without folding its forms', () => {
  assert.deepEqual(
    parse('((I x) (S a b c))'),
    [['I', 'x'], ['S', 'a', 'b', 'c']])
})

test('requires one complete expression', () => {
  assert.throws(() => parse(''), /Missing expression/)
  assert.throws(() => parse('('), /Missing \)/)
  assert.throws(() => parse('a b'), /Expected one expression/)
})

test('keeps () out of source', () => {
  assert.throws(() => parse('()'), /Unexpected \(\)/)
  assert.throws(() => parse('(() ())'), /Unexpected \(\)/)
})
