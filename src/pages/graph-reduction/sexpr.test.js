import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, parse, serialize } from './sexpr.js'
import { observe } from './observe.js'

const observeUntilStable = (term, remaining = 32) => {
  const next = observe(term)
  if (next === term) return term
  if (remaining <= 0) throw new Error('Expression did not settle')
  return observeUntilStable(next, remaining - 1)
}

const settle = source =>
  serialize(observeUntilStable(compile(source)))

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

  test('serializes compiled slots as folding instructions', () =>
    assert.equal(serialize(compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)), '(((((0 2) (1 2)) a) b) c)'))

  test('serializes observed folding steps by remaining fill order', () => {
    const step0 = compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)
    const step1 = observe(step0)
    const step2 = observe(step1)
    const step3 = observe(step2)

    assert.equal(serialize(step0), '(((((0 2) (1 2)) a) b) c)')
    assert.equal(serialize(step1), '((((a 1) (0 1)) b) c)')
    assert.equal(serialize(step2), '(((a 0) (b 0)) c)')
    assert.equal(serialize(step3), '((a c) (b c))')
  })

  test('serializes manual fixed points with traversal-local fallback labels', () => {
    const point = []
    point[0] = point
    point[1] = 'a'

    assert.equal(serialize(point), '0')
  })

  test('serializes projection fallbacks inside folding templates', () => {
    const pair = compile('(defn P (x y) (x y))\n((P a) b)')
    const inner = compile('(defn I (x) x)\n(I q)')
    const innerEmpty = compile('(defn I (x) x)\n(I ())')
    const point = []
    point[0] = point
    point[1] = 'm'

    assert.equal(serialize([[pair[0], []], pair[1]]),
                 '((((0 ()) 1) a) b)')
    assert.equal(serialize([[pair[0], inner], pair[1]]),
                 '((((0 (0 q)) 1) a) b)')
    assert.equal(serialize([[pair[0], ['x', inner]], pair[1]]),
                 '((((0 (x q)) 1) a) b)')
    assert.equal(serialize([[pair[0], ['x', innerEmpty]], pair[1]]),
                 '((((0 (x ())) 1) a) b)')
    assert.equal(serialize([[pair[0], point], pair[1]]),
                 '((((0 0) 1) a) b)')
    assert.equal(serialize([inner, point]), '((0 q) 0)')
    assert.equal(serialize([inner, []]), '((0 q) ())')
  })

  test('rejects non-pair arrays inside projected output', () => {
    const pair = compile('(defn P (x y) (x y))\n((P a) b)')
    const inner = compile('(defn I (x) x)\n(I q)')
    const filled = compile('(defn I (x) x)\n(I (a b))')
    filled[1].pop()

    assert.throws(() => serialize([[pair[0], ['bad']], pair[1]]),
                  /empty or pairs/i)
    assert.throws(() => serialize([inner, ['bad']]), /empty or pairs/i)
    assert.throws(() => serialize([[pair[0], ['x', filled]], pair[1]]),
                  /empty or pairs/i)
  })
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

  test('serializes bare non-zero-argument defn symbols as names', () =>
    assert.equal(serialize(compile(`
      (defn I (x) x)
      I
    `)), 'I'))

  test('leaves bare non-template defn symbols alone', () =>
    assert.equal(compile(`
      (defn F (x) (x y))
      F
    `), 'F'))

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

  test('expands def aliases to plain atoms', () =>
    assert.equal(compile(`
      (def answer value)
      answer
    `), 'value'))

  test('compiles fully applied defn parameters as fixed points', () => {
    const motif = compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)

    const p0 = motif[0][0]
    const p1 = motif[1][0]
    const p2 = motif[0][1]

    assert.equal(p0[0], p0)
    assert.equal(p0[1], 'a')
    assert.equal(p1[0], p1)
    assert.equal(p1[1], 'b')
    assert.equal(p2[0], p2)
    assert.equal(p2[1], 'c')
    assert.equal(motif[1][1], p2)
  })

  test('compiles numeric def templates as shared fixed points', () => {
    const motif = compile(`
      (def S ((0 2) (1 2)))
      (((S a) b) c)
    `)

    const p0 = motif[0][0]
    const p1 = motif[1][0]
    const p2 = motif[0][1]

    assert.equal(p0[0], p0)
    assert.equal(p0[1], 'a')
    assert.equal(p1[0], p1)
    assert.equal(p1[1], 'b')
    assert.equal(p2[0], p2)
    assert.equal(p2[1], 'c')
    assert.equal(motif[1][1], p2)
  })

  test('shares repeated numeric template slots', () => {
    const motif = compile(`
      (def D (0 0))
      (D a)
    `)

    assert.equal(motif[0], motif[1])
    assert.equal(motif[0][0], motif[0])
    assert.equal(motif[0][1], 'a')
    assert.equal(serialize(motif), '((0 0) a)')
  })

  test('compiles direct numeric slot applications as fixed points', () => {
    const motif = compile('(0 a)')

    assert.equal(motif[0], motif)
    assert.equal(motif[1], 'a')
    assert.equal(serialize(motif), '(0 a)')
  })

  test('reapplies extra arguments after fully applied defns', () => {
    const motif = compile(`
      (defn I (x) x)
      ((I a) b)
    `)

    assert.equal(motif[0][0], motif[0])
    assert.equal(motif[0][1], 'a')
    assert.equal(motif[1], 'b')
  })

  test('consumes unused defn parameters without reapplying them', () => {
    const motif = compile(`
      (defn K (x y) x)
      ((K a) b)
    `)

    assert.equal(motif[0], motif)
    assert.equal(motif[1], 'a')
    assert.equal(serialize(motif), '(0 a)')
  })

  test('applies fold values passed through higher-order templates', () =>
    assert.equal(settle(`
      (defn K (x y) x)
      (defn S (x y z) ((x z) (y z)))
      (((S K) K) a)
    `), 'a'))

  test('compiles non-template defn bodies with fixed-point locals', () =>
    assert.equal(serialize(compile(`
      (defn F (x) (x y))
      ((F a) b)
    `)), '(((0 a) y) b)'))

  test('compiles empty non-template defn bodies', () =>
    assert.equal(serialize(compile(`
      (defn E (x) ())
      (E a)
    `)), '()'))

  test('reapplies extra arguments after numeric templates', () =>
    assert.equal(serialize(compile(`
      (def S ((0 2) (1 2)))
      ((((S a) b) c) d)
    `)), '((((((0 2) (1 2)) a) b) c) d)'))

  test('keeps partially applied folding definitions as source applications', () => {
    assert.equal(serialize(compile(`
      (defn S (x y z) ((x z) (y z)))
      (S a)
    `)), '(S a)')
    assert.equal(serialize(compile(`
      (def S ((0 2) (1 2)))
      (S a)
    `)), '(S a)')
  })

  test('lowers dynamic fold applications inside ordinary right branches', () =>
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn return-I (x) I)
      (x ((return-I q) a))
    `)), '(x a)'))

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

  test('rejects sparse numeric slot templates', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def bad (0 2))\n(((bad a) b) c)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /dense slots/i)
  })

  test('rejects negative numeric slot templates', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def bad (0 -1))\n((bad a) b)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /non-negative integer/i)
  })

  test('rejects non-integer numeric slot templates', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def bad (0 1.5))\n((bad a) b)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /non-negative integer/i)
  })

  test('rejects recursive definitions', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def loop loop)\nloop')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /recursive definitions/i)
  })

  test('rejects recursive function aliases during application', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    compile('(def loop loop)\n(loop a)')
    assert.equal(mock.callCount(), 1)
    assert.match(mock.calls[0].arguments[0].message, /recursive definitions/i)
  })
})
