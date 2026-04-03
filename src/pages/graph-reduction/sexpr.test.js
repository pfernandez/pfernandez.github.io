import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { parse, resolve, serialize } from './sexpr.js'

describe('pair parser', () => {
  test('parses empty input as empty list', () => {
    assert.deepEqual(parse(''), [])
    assert.deepEqual(parse('   \n\t'), [])
  })

  test('parses atoms (symbols and numbers)', () => {
    assert.equal(parse('foo'), 'foo')
    assert.equal(parse('42'), 42)
    assert.equal(parse('-3'), -3)
    assert.equal(parse('3.14'), 3.14)
  })

  test('parses empty list', () => {
    assert.deepEqual(parse('()'), [])
  })

  test('parses binary list', () => {
    assert.deepEqual(parse('(a b)'), ['a', 'b'])
  })

  test('parses nested binary lists', () => {
    assert.deepEqual(parse('((a b) (c (d e)))'), [['a', 'b'], ['c', ['d', 'e']]])
  })

  test('strips line comments', () => {
    assert.deepEqual(parse('; comment\n(a b)'), ['a', 'b'])
    assert.deepEqual(parse('(a ; inline\n b)'), ['a', 'b'])
  })

  test('rejects non-binary lists', () => {
    assert.throws(() => parse('(a b c)'), /exactly 2 elements/i)
  })

  test('rejects extra content after one expression', () => {
    assert.throws(() => parse('a b'), /Extra content/i)
    assert.throws(() => parse('(() x) y'), /Extra content/i)
  })

  test('rejects malformed parentheses', () => {
    assert.throws(() => parse(')'), /Unexpected \)/i)
    assert.throws(() => parse('(a b'), /Missing \)/i)
  })
})

describe('pair serializer', () => {
  test('serializes atoms and pairs canonically', () => {
    assert.equal(serialize('foo'), 'foo')
    assert.equal(serialize(42), '42')
    assert.equal(serialize([]), '()')
    assert.equal(serialize([[], 'x']), '(() x)')
    assert.equal(serialize([['a', 'b'], ['c', ['d', 'e']]]),
                 '((a b) (c (d e)))')
  })

  test('round-trips valid terms through parse and serialize', () => {
    const cases = [
      '',
      'foo',
      '42',
      '()',
      '(a b)',
      '((() a) (() b))',
      '; comment\n((a b) ; inline\n (c d))'
    ]

    for (const source of cases) {
      const pair = parse(source)
      assert.deepEqual(parse(serialize(pair)), pair)
    }
  })
})

describe('resolve', () => {
  test('resolves S in fill-order indices', () => {
    const term = parse('(((((0 2) (1 2)) a) b) c)')
    assert.deepEqual(resolve(term),
                     [['a', 'c'],
                      ['b', 'c']])
  })

  test('preserves extra args outside the motif', () => {
    const term = parse('((((((0 2) (1 2)) a) b) c) d)')
    assert.deepEqual(resolve(term),
                     [[['a', 'c'],
                       ['b', 'c']],
                      'd'])
  })

  test('shares duplicated arguments by identity', () => {
    const term = parse('(((((0 2) (1 2)) a) b) (u v))')
    const out = resolve(term)
    assert.deepEqual(out,
                     [['a', ['u', 'v']],
                      ['b', ['u', 'v']]])
    assert.equal(out[0][1], out[1][1])
  })
})
