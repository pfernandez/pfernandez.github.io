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
    parse('(')
    assert.equal(mock.callCount(), 2)
    assert.match(mock.calls[1].arguments[0].message, /Missing \)/i)
    parse('(a')
    assert.equal(mock.callCount(), 3)
    assert.match(mock.calls[2].arguments[0].message, /Unexpected EOF while reading/i)
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
  test('replaces numbered slots with ordered arguments', () =>
    assert.deepEqual(build(parse('(((((0 2) (1 2)) a) b) c)')),
                     [['a', 'c'], ['b', 'c']]))

  test('preserves empty pairs', () => {
    assert.deepEqual(build(parse('(() a)')), [[], 'a'])
    assert.deepEqual(build(parse('(a ())')), ['a', []])
  })

  test('preserves unused arguments', () =>
    assert.deepEqual(build(parse('((((((0 2) (1 2)) a) b) c) d)')),
                     [[['a', 'c'], ['b', 'c']], 'd']))

  test('reuses the same argument object at repeated slots', () => {
    // Wrap the arguments in array objects to comapare referential identity.
    const a = ['a', []]
    const b = ['b', []]
    const c = ['c', []]

    // Describe the desred result with reverse De Brujin indices.
    const S = [[0, 2], [1, 2]]

    // Construct the full expression.
    const expr = [[[S, a], b], c]

    // Validate that we've constructed it as the parser would.
    assert.deepEqual(expr, parse('(((((0 2) (1 2)) (a ())) (b ())) (c ()))'))

    // Replace the De Brujin numbers with direct argument references.
    const struct = build(expr)

    // Validate that the resulting structure has the desired shape.
    assert.deepEqual(struct, parse('(((a ()) (c ())) ((b ()) (c ())))'))

    // Show that inserted arguments retain their original identity.
    assert.strictEqual(struct[0][0], a)
    assert.strictEqual(struct[1][0], b)

    // and that multiple instances of the same argument are shared.
    assert.strictEqual(struct[0][1], c)
    assert.strictEqual(struct[1][1], c)
  })

  test('returns non-applications unchanged', () => {
    assert.equal(build('x'), 'x')
    assert.deepEqual(build([]), [])
  })

  test('rejects out-of-range slots', () =>
    assert.throws(() => build(parse('(2 a)')), /Unbound slot: 2/))
})
