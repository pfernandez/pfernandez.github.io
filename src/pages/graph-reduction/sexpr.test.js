import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { build, parse, serialize } from './sexpr.js'

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

  test('parses empty list', () => assert.deepEqual(parse('()'), []))

  test('parses binary list', () => assert.deepEqual(parse('(a b)'), ['a', 'b']))

  test('parses nested binary lists', () => assert.deepEqual(
    parse('((() a) (b (c ())))'), [[[], 'a'], ['b', ['c', []]]]))

  test('strips line breaks', () => assert.deepEqual(
    parse('\n(\na\n(\n(\n)\nb\n)\n)\n'), ['a', [[], 'b']]))

  test('strips comments', () => {
    assert.deepEqual(parse('; comment\n(a b)'), ['a', 'b'])
    assert.deepEqual(parse('(a ; inline\n b)'), ['a', 'b'])
  })

  test('rejects non-binary lists', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    parse('(a b c)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /exactly 2 elements/i)
  })

  test('rejects extra content after one expression', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    parse('a b')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /Extra content/i)
    parse('(() x) y')
    assert.equal(mock.callCount(), 2)
    assert.match(mock.calls[1].arguments[0].message, /Extra content/i)
  })

  test('rejects malformed parentheses', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    parse(')')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /Unexpected \)/i)
    parse('(a b')
    assert.equal(mock.callCount(), 2)
    assert.match(mock.calls[1].arguments[0].message, /Missing \)/i)
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

describe('build', () => {
  test('builds ((0 2) (1 2)) with fill-order slots', () => {
    const term = parse('(((((0 2) (1 2)) a) b) c)')
    assert.deepEqual(build(term), [['a', 'c'], ['b', 'c']])
  })

  test('leaves extra applied args outside the built motif', () => {
    const term = parse('((((((0 2) (1 2)) a) b) c) d)')
    assert.deepEqual(build(term), [[['a', 'c'], ['b', 'c']], 'd'])
  })

  test('reuses the same argument object at repeated slots', () => {
    const term = parse('(((((0 2) (1 2)) a) b) (u v))')
    const out = build(term)
    assert.deepEqual(out, [['a', ['u', 'v']], ['b', ['u', 'v']]])
    assert.equal(out[0][1], out[1][1])
  })
})

