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
  // Wrap arguments in arrays to allow comaparison by reference.
  const a = ['a', []]
  const b = ['b', []]
  const c = ['c', []]

  // Describe the desred result with reverse De Brujin indices.
  const S = [[0, 2], [1, 2]]

  // Construct the full expression.
  const expr = [[[S, a], b], c]

  // Replace the numbered De Brujin targets with shared binder cells.
  const struct = build(expr)
  const expectedStruct = [[[[[[[], a], [[], c]], [[[], b], [[], c]]], a], b], c]

  test('replaces numbered slots with shared binder cells', () =>
    assert.deepStrictEqual(struct, expectedStruct))

  test('preserves unused arguments', () =>
    assert.deepStrictEqual([build(expr), 'd'], [expectedStruct, 'd']))

  test('preserves left empty pairs without evaluating right', () =>
    assert.deepStrictEqual(build([[], expr]), [[], expr]))

  test('returns empty pairs unchanged', () =>
    assert.deepStrictEqual(build([]), []))

  test('preserves right empty pairs while evaluating left', () =>
    assert.deepStrictEqual(build([expr, []]), [expectedStruct, []]))

  test('preserves atomic leaves inside instantiated heads', () =>
    assert.deepStrictEqual(build(parse('((foo 0) a)')),
                           [['foo', [[], 'a']], 'a']))

  test('returns strings unchanged', () => assert.strictEqual(build('x'), 'x'))

  test('returns numbers unchanged', () => assert.deepStrictEqual(build(0), 0))

  // Get the direct references at each node.
  const [[[left, ax], by], cz] = struct
  const [[x, z0], [y, z1]] = left

  test('leaves original argument positions unchanged', () => {
    assert.strictEqual(ax, a)
    assert.strictEqual(by, b)
    assert.strictEqual(cz, c)
  })

  test('replaces slots with binder cells carrying the original arguments', () => {
    assert.strictEqual(x[1], a)
    assert.strictEqual(y[1], b)
    assert.strictEqual(z0[1], c)
  })

  test('replaces De Brujin numbers with binder cells whose left children are empty pairs', () => {
    assert.deepStrictEqual(x[0], [])
    assert.deepStrictEqual(y[0], [])
    assert.deepStrictEqual(z0[0], [])
    assert.deepStrictEqual(z1[0], [])
  })

  test('shares the same binder cells at repeated targets', () =>
    assert.strictEqual(z0, z1))

  test('rejects out-of-range slots', () =>
    assert.throws(() => build(parse('(2 a)')), /Unbound slot: 2/))

  test('rejects slots beyond the collected spine', () =>
    assert.throws(() => build(parse('((0 1) a)')), /Unbound slot: 1/))

  test('returns a single linked input for one used argument', () =>
    assert.deepEqual(build(parse('(0 a)')), [[[], 'a'], 'a']))

  test('leaves unused outer arguments outside the built result', () =>
    assert.deepEqual(build(parse('((0 a) b)')), [[[[], 'a'], 'a'], 'b']))
})
