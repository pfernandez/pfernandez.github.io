import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { parseSexpr } from '../src/pages/graph-reduction/collapse/sexpr.js'

describe('collapse sexpr parser', () => {
  test('parses empty input as empty list', () => {
    assert.deepEqual(parseSexpr(''), [])
    assert.deepEqual(parseSexpr('   \n\t'), [])
  })

  test('parses atoms (symbols and numbers)', () => {
    assert.equal(parseSexpr('foo'), 'foo')
    assert.equal(parseSexpr('42'), 42)
    assert.equal(parseSexpr('-3'), -3)
    assert.equal(parseSexpr('3.14'), 3.14)
  })

  test('parses empty list', () => {
    assert.deepEqual(parseSexpr('()'), [])
  })

  test('parses binary list', () => {
    assert.deepEqual(parseSexpr('(a b)'), ['a', 'b'])
  })

  test('parses nested binary lists', () => {
    assert.deepEqual(parseSexpr('((a b) (c (d e)))'), [['a', 'b'], ['c', ['d', 'e']]])
  })

  test('strips line comments', () => {
    assert.deepEqual(parseSexpr('; comment\n(a b)'), ['a', 'b'])
    assert.deepEqual(parseSexpr('(a ; inline\n b)'), ['a', 'b'])
  })

  test('rejects non-binary lists', () => {
    assert.throws(() => parseSexpr('(a b c)'), /exactly 2 elements/i)
  })

  test('rejects extra content after one expression', () => {
    assert.throws(() => parseSexpr('a b'), /Extra content/i)
    assert.throws(() => parseSexpr('(() x) y'), /Extra content/i)
  })

  test('rejects malformed parentheses', () => {
    assert.throws(() => parseSexpr(')'), /Unexpected \)/i)
    assert.throws(() => parseSexpr('(a b'), /Missing \)/i)
  })
})

