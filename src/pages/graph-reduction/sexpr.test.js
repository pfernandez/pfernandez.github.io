import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, parse, serialize } from './sexpr.js'

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
    assert.match(mock.calls[2].arguments[0].message, /Missing \)/i)
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

  test('serializes numeric slot motifs', () =>
    assert.equal(serialize([[[[[0, 2], [1, 2]], 'a'], 'b'], 'c']),
                 '(((((0 2) (1 2)) a) b) c)'))
})

describe('compiler', () => {
  test('compiles empty program input as empty list', () => {
    assert.deepEqual(compile(''), [])
    assert.deepEqual(compile(' \n\t '), [])
  })

  test('compiles an empty final expression', () =>
    assert.deepEqual(compile('()'), []))

  test('leaves atom-only programs alone', () => {
    assert.equal(compile('name'), 'name')
    assert.equal(compile('7'), 7)
  })

  test('leaves a plain expression alone', () =>
    assert.deepEqual(compile('(((f x) y) z)'),
                     parse('(((f x) y) z)')))

  test('left-associates n-ary applications', () =>
    assert.deepEqual(compile('(f x y z)'),
                     parse('(((f x) y) z)')))

  test('expands def aliases into the final expression', () =>
    assert.deepEqual(compile(`
      (def I (() 0))
      (def id I)
      ((id a) b)
    `), parse('(((() 0) a) b)')))

  test('expands zero-argument defns', () =>
    assert.equal(compile(`
      (defn answer () 42)
      answer
    `), 42))

  test('clones repeated definition expansions', () => {
    const tree = compile(`
      (def pair-ab (a b))
      (pair-ab pair-ab)
    `)

    assert.deepEqual(tree, parse('((a b) (a b))'))
    assert.notStrictEqual(tree[0], tree[1])
  })

  test('rejects programs without a final expression', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def I (() 0))')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /must end with an expression/i)
  })

  test('rejects non-list defn params', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(defn I x x)\n(I a)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /params must be a list/i)
  })

  test('rejects short def forms', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def I)\nI')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /def name body/i)
  })

  test('rejects short defn forms', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(defn I (x))\n(I a)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /defn name/i)
  })

  test('rejects non-symbol def names', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def 0 a)\na')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /def name must be a symbol/i)
  })

  test('rejects non-symbol defn names', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(defn 0 (x) x)\n(0 a)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /defn name must be a symbol/i)
  })

  test('rejects non-symbol defn params', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(defn I (x 0) x)\n(I a)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /params must be symbols/i)
  })

  test('rejects recursive definitions', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def loop loop)\nloop')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /recursive definitions/i)
  })
})
