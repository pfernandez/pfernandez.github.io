import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { build, buildOne, parse, serialize } from './sexpr.js'

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

  test('preserves De Brujin indices', () =>
    assert.deepEqual(parse('(((((0 2) (1 2)) a) b) c)'),
                     [[[[[0, 2], [1, 2]], 'a'], 'b'], 'c']))

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
    parse('(')
    assert.equal(mock.callCount(), 2)
    assert.match(mock.calls[1].arguments[0].message, /Missing \)/i)
    parse('(a')
    assert.equal(mock.callCount(), 3)
    assert.match(mock.calls[2].arguments[0].message,
                 /Unexpected EOF while reading/i)
    parse('(a b')
    assert.equal(mock.callCount(), 4)
    assert.match(mock.calls[3].arguments[0].message, /Missing \)/i)
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

  test('round-trips valid terms through parse and serialize', () =>
    ['', 'foo',
     '42',
     '()',
     '(a b)',
     '((() a) (() b))',
     '; comment\n((a b) ; inline\n (c d))'].forEach(source => {
      const pair = parse(source)
      assert.deepEqual(parse(serialize(pair)), pair)
    }))

  test('rejects non-pair arrays', () => {
    assert.throws(() => serialize(['a']), /empty or pairs/i)
    assert.throws(() => serialize(['a', 'b', 'c']), /empty or pairs/i)
  })
})

describe('build', () => {
  // Wrap arguments in arrays to allow comparison by reference.
  const a = ['a', []]
  const b = ['b', []]
  const c = ['c', []]

  // Describe the desired result with reverse De Bruijn indices.
  const S = [[0, 2], [1, 2]]

  // Construct the full expression.
  const expr = [[[S, a], b], c]

  // Fill the numbered targets with shared inputs.
  const struct = build(expr)
  const expectedStruct = [[a, c], [b, c]]

  test('fills the used inputs into the head', () =>
    assert.deepStrictEqual(struct, expectedStruct))

  test('keeps unused outer inputs outside', () =>
    assert.deepStrictEqual([build(expr), 'd'], [expectedStruct, 'd']))

  test('preserves left empty pairs without evaluating right', () =>
    assert.deepStrictEqual(build([[], expr]), [[], expr]))

  test('leaves empty pairs alone', () =>
    assert.deepStrictEqual(build([]), []))

  test('builds the left side without touching the right', () =>
    assert.deepStrictEqual(build([expr, []]), [expectedStruct, []]))

  test('fills plain names into the head', () =>
    assert.deepStrictEqual(build(parse('((foo 0) a)')), ['foo', 'a']))

  test('leaves strings alone', () => assert.strictEqual(build('x'), 'x'))

  test('leaves numbers alone', () => assert.deepStrictEqual(build(0), 0))

  const [[ax, z0], [by, z1]] = struct

  test('keeps the original inputs in place', () => {
    assert.strictEqual(ax, a)
    assert.strictEqual(by, b)
  })

  test('reuses the same input where a slot repeats', () => {
    assert.strictEqual(z0, c)
    assert.strictEqual(z1, c)
  })

  test('shares the same repeated input', () =>
    assert.strictEqual(z0, z1))

  test('rejects out-of-range slots', () =>
    assert.throws(() => build(parse('(2 a)')), /Unbound slot: 2/))

  test('rejects slots beyond the collected spine', () =>
    assert.throws(() => build(parse('((0 1) a)')), /Unbound slot: 1/))

  test('fills one input directly', () =>
    assert.deepEqual(build(parse('(0 a)')), 'a'))

  test('leaves unused outer arguments outside the built result', () =>
    assert.deepEqual(build(parse('((0 a) b)')), ['a', 'b']))

  test('leaves (() a) alone', () =>
    assert.deepEqual(build(parse('(() a)')), [[], 'a']))
})

describe('build one step at a time', () => {
  test('fills a before b before c in S', () => {
    const source = parse('(((((0 2) (1 2)) a) b) c)')

    const afterA = buildOne(source)
    assert.deepEqual(afterA, parse('((((a 1) (0 1)) b) c)'))

    const afterB = buildOne(afterA)
    assert.deepEqual(afterB, parse('(((a 0) (b 0)) c)'))

    const afterC = buildOne(afterB)
    assert.deepEqual(afterC, parse('((a c) (b c))'))
  })

  test('drops the first input even when the head does not use it', () => {
    const source = parse('((1 a) b)')
    assert.deepEqual(buildOne(source), parse('(0 b)'))
  })

  test('leaves built terms alone', () =>
    assert.deepEqual(buildOne(parse('((a c) (b c))')),
                     parse('((a c) (b c))')))
})
