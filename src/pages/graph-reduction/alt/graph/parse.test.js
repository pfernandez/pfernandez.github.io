import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parse } from './index.js'

describe('source parser', () => {
  test('parse returns no forms for blank input', () => {
    assert.deepEqual(parse(''), [])
    assert.deepEqual(parse('   \n\t'), [])
  })

  test('parse returns symbol and number atoms', () => {
    assert.deepEqual(parse('foo'), ['foo'])
    assert.deepEqual(parse('42'), [42])
    assert.deepEqual(parse('-3'), [-3])
    assert.deepEqual(parse('3.14'), [3.14])
  })

  test('parse reads () as one empty-list form', () =>
    assert.deepEqual(parse('()'), [[]]))

  test('parse reads binary lists', () =>
    assert.deepEqual(parse('(a b)'), [['a', 'b']]))

  test('parse preserves nested binary lists', () => assert.deepEqual(
    parse('((() a) (b (c ())))'), [[[[], 'a'], ['b', ['c', []]]]]))

  test('parse ignores line breaks', () => assert.deepEqual(
    parse('\n(\na\n(\n(\n)\nb\n)\n)\n'), [['a', [[], 'b']]]))

  test('parse ignores comments', () => {
    assert.deepEqual(parse('; comment\n(a b)'), [['a', 'b']])
    assert.deepEqual(parse('(a ; inline\n b)'), [['a', 'b']])
  })

  test('parse preserves n-ary lists and top-level order', () => {
    assert.deepEqual(parse('(x)'), [['x']])
    assert.deepEqual(parse('(a b c)'), [['a', 'b', 'c']])
    assert.deepEqual(parse('a b'), ['a', 'b'])
    assert.deepEqual(parse('(() x) y'), [[[], 'x'], 'y'])
  })

  test('parse rejects malformed parentheses', () => {
    assert.throws(() => parse(')'), /Unexpected \)/i)
    assert.throws(() => parse('('), /Missing \)/i)
    assert.throws(() => parse('(a'), /Missing \)/i)
    assert.throws(() => parse('(a b'), /Missing \)/i)
  })
})
