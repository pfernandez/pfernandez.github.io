import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, construct, encode, parse, serialize } from './sexpr.js'
import { observe } from './observe.js'

const observeUntilStable = (term, remaining = 32) => {
  const next = observe(term)
  if (next === term) return term
  if (remaining <= 0) throw new Error('Expression did not settle')
  return observeUntilStable(next, remaining - 1)
}

const serializeTicks = (term, count) =>
  count <= 0 ? [] : [serialize(term),
                     ...serializeTicks(observe(term), count - 1)]

const settle = source =>
  serialize(observeUntilStable(compile(source)))

const parseTerm = source => parse(source)[0]

const projection = source =>
  parseTerm(serialize(compile(source)))

const encoded = source =>
  encode(parse(source))

const zPrelude = `
  (defn APPLY-SELF (x v) ((x x) v))
  (defn THETA (f x) (f (APPLY-SELF x)))
  (defn Z (f) ((THETA f) (THETA f)))
`

const zProgram = source =>
  `${zPrelude}\n${source}`

const loggedErrors = (t, actions) => {
  const { mock } = t.mock.method(console, 'error', () => {})
  actions.forEach(action => action())
  return mock.calls.map(call => call.arguments[0].message)
}

const assertCompileError = (t, source, pattern) => {
  const messages = loggedErrors(t, [() => compile(source)])
  assert.equal(messages.length, 1)
  assert.match(messages[0], pattern)
}

const assertFixedPayload = (point, value) => {
  assert.equal(point[0], point)
  assert.equal(point[1], value)
}

const assertSShape = motif => {
  const p0 = motif[0][0]
  const p1 = motif[1][0]
  const p2 = motif[0][1]

  assertFixedPayload(p0, 'a')
  assertFixedPayload(p1, 'b')
  assertFixedPayload(p2, 'c')
  assert.equal(motif[1][1], p2)
}

describe('source parser', () => {
  test('parses empty input as empty list', () => {
    assert.deepEqual(parse(''), [])
    assert.deepEqual(parse('   \n\t'), [])
  })

  test('parses atoms (symbols and numbers)', () => {
    assert.deepEqual(parse('foo'), ['foo'])
    assert.deepEqual(parse('42'), [42])
    assert.deepEqual(parse('-3'), [-3])
    assert.deepEqual(parse('3.14'), [3.14])
  })

  test('parses empty list', () => assert.deepEqual(parse('()'), [[]]))

  test('parses binary list', () =>
    assert.deepEqual(parse('(a b)'), [['a', 'b']]))

  test('parses nested binary lists', () => assert.deepEqual(
    parse('((() a) (b (c ())))'), [[[[], 'a'], ['b', ['c', []]]]]))

  test('strips line breaks', () => assert.deepEqual(
    parse('\n(\na\n(\n(\n)\nb\n)\n)\n'), [['a', [[], 'b']]]))

  test('strips comments', () => {
    assert.deepEqual(parse('; comment\n(a b)'), [['a', 'b']])
    assert.deepEqual(parse('(a ; inline\n b)'), [['a', 'b']])
  })

  test('parses n-ary source lists and multiple top-level forms', () => {
    assert.deepEqual(parse('(x)'), [['x']])
    assert.deepEqual(parse('(a b c)'), [['a', 'b', 'c']])
    assert.deepEqual(parse('a b'), ['a', 'b'])
    assert.deepEqual(parse('(() x) y'), [[[], 'x'], 'y'])
  })

  test('rejects malformed parentheses', t => {
    const messages = loggedErrors(t, [
      () => parse(')'),
      () => parse('('),
      () => parse('(a'),
      () => parse('(a b')
    ])

    assert.equal(messages.length, 4)
    assert.match(messages[0], /Unexpected \)/i)
    assert(messages.slice(1).every(message => /Missing \)/i.test(message)))
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
    ['foo',
     '42',
     '()',
     '(a b)',
     '((() a) (() b))',
     '; comment\n((a b) ; inline\n (c d))'].forEach(source => {
      const pair = parseTerm(source)
      assert.deepEqual(parseTerm(serialize(pair)), pair)
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

  test('serializes S projection while preserving one shared c event', () => {
    const step0 = compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)
    const c = step0[0][1]
    const step1 = observe(step0)
    const step2 = observe(step1)
    const step3 = observe(step2)

    assert.equal(step0[1][1], c)
    assert.equal(step1[0][1], c)
    assert.equal(step1[1][1], c)
    assert.equal(step2[0][1], c)
    assert.equal(step2[1][1], c)
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

  test('serializes passive filled closures under atom-headed pairs', () => {
    const empty = compile('(defn I (x) x)\n(x (I ()))')
    const malformed = compile('(defn I (x) x)\n(x (I (a b)))')

    assert.equal(serialize(empty), '(x ())')
    malformed[1][1].pop()
    assert.throws(() => serialize(malformed), /empty or pairs/i)
  })
})

describe('compiler', () => {
  test('compiles empty program input as empty list', () => {
    assert.deepEqual(compile(''), [])
    assert.deepEqual(compile(' \n\t '), [])
  })

  test('encodes source forms and constructs folding terms', () => {
    const encoded = [[[[[0, 2], [1, 2]], 'a'], 'b'], 'c']
    const source = `
      (def S ((0 2) (1 2)))
      (((S a) b) c)
    `

    assert.deepEqual(encode(parse('')), [])
    assert.deepEqual(encode(parse('()')), [])
    assert.deepEqual(construct([]), [])
    assert.deepEqual(encode([
      ['def', 'S', [[0, 2], [1, 2]]],
      ['S', 'a', 'b', 'c']
    ]), encoded)
    assert.deepEqual(encode(parse('(((((0 2) (1 2)) a) b) c)')),
                     encoded)
    assert.equal(serialize(construct(encoded)),
                 '(((((0 2) (1 2)) a) b) c)')
    assert.equal(serialize(construct(encode(parse(source)))),
                 '(((((0 2) (1 2)) a) b) c)')
  })

  test('encodes source as the serialized compile projection', () =>
    ['',
     '()',
     '(f x y)',
     '(defn I (x) x)\n(I a)',
     '(defn K (x y) x)\n((K a) b)',
     '(defn S (x y z) ((x z) (y z)))\n(((S a) b) c)',
     '(def S ((0 2) (1 2)))\n(((S a) b) c)',
     '(defn F (x) (x y))\n((F a) b)',
     '(defn APPLY-SELF (x v) ((x x) v))\n' +
       '(defn THETA (f x) (f (APPLY-SELF x)))\n' +
       '(defn Z (f) ((THETA f) (THETA f)))\n' +
       '(Z f)'].forEach(source =>
      assert.deepEqual(encoded(source), projection(source), source)))

  test('construct rebuilds the projected graph, not hidden closure identity', () => {
    const source = '(defn I (x) x)\n(x (I a))'
    const graph = compile(source)
    const rebuilt = construct(encoded(source))

    assert.equal(serialize(rebuilt), serialize(graph))
    assert.equal(graph[1][0], graph[1])
    assert.equal(rebuilt[1], 'a')
  })

  test('constructs ordinary terms when no dense template boundary exists', () => {
    assert.equal(construct(['x']), 'x')
    assert.equal(serialize(construct(['f', 'x'])), '(f x)')
    assert.equal(serialize(construct([[[2, 1], 'f'], 'x'])),
                 '(((2 1) f) x)')
  })

  test('construct rejects invalid numeric template atoms', () =>
    assert.throws(() => construct([[0, -1], 'a']), /non-negative integer/i))

  test('compiles an empty final expression', () =>
    assert.deepEqual(compile('()'), []))

  test('leaves atom-only programs alone', () => {
    assert.equal(compile('name'), 'name')
    assert.equal(compile('7'), 7)
    assert.equal(compile('(name)'), 'name')
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
                     parseTerm('(((f x) y) z)')))

  test('left-associates n-ary applications', () =>
    assert.deepEqual(compile('(f x y z)'),
                     parseTerm('(((f x) y) z)')))

  test('expands def aliases into the final expression', () =>
    assert.deepEqual(compile(`
      (def I (() 0))
      (def id I)
      ((id a) b)
    `), parseTerm('(((() 0) a) b)')))

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

    assertSShape(motif)
  })

  test('compiles numeric def templates as shared fixed points', () => {
    const motif = compile(`
      (def S ((0 2) (1 2)))
      (((S a) b) c)
    `)

    assertSShape(motif)
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

  test('encodes dynamic fold applications inside ordinary right branches', () =>
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn return-I (x) I)
      (x ((return-I q) a))
    `)), '(x a)'))

  test('keeps non-transition dynamic folds on the ordinary path', () => {
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn F (x) (x y))
      ((I F) a)
    `)), '((0 a) y)')
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn F (x y) ((x y) z))
      (((I F) a) b)
    `)), '((((0 1) a) b) z)')
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn F (x y) (helper x))
      (((I F) a) b)
    `)), '(helper a)')
  })

  test('does not force ordinary calls into state loops', () => {
    assert.equal(serialize(compile(`
      (defn STEP (self state) (self (state tick)))
      ((STEP f) seed)
    `)), '(((0 (1 tick)) f) seed)')
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn STEP (self state) (self (state tick)))
      (((I STEP) f) seed)
    `)), '(((0 (1 tick)) f) seed)')
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn STEP (self state other) (self (other tick)))
      ((((I STEP) f) seed) spare)
    `)), '(((0 (1 tick)) f) spare)')
    assert.equal(serialize(compile(`
      (defn I (x) x)
      (defn STEP (self state) (self state))
      (((I STEP) f) seed)
    `)), '(((0 1) f) seed)')
    assert.equal(serialize(compile(`
      (defn STEP (self state) (self (state tick)))
      (defn return-STEP (x) STEP)
      (((return-STEP q) f) seed)
    `)), '(((0 (1 tick)) f) seed)')
  })

  test('keeps state-prefixed Z updates on the transition loop', () => {
    const ticks = serializeTicks(compile(zProgram(`
      (defn STEP (self state) (self ((state tick) tock)))
      ((Z STEP) seed)
    `)), 4)

    assert.deepEqual(ticks,
                     ['(0 (0 seed))',
                      '(((0 tick) tock) (0 seed))',
                      '(((((0 tick) tock) tick) tock) (0 seed))',
                      '(((((((0 tick) tock) tick) tock) tick) tock) (0 seed))'])
  })

  test('leaves nearby recursive Z shapes on the ordinary path', () => {
    const swapped = serializeTicks(compile(zProgram(`
      (defn STEP (state self) (self (state tick)))
      ((Z STEP) seed)
    `)), 3)
    const atomHeaded = serializeTicks(compile(zProgram(`
      (defn STEP (self state) (self (next state)))
      ((Z STEP) seed)
    `)), 3)

    assert.deepEqual(swapped,
                     ['((0 seed) ((0 (0 tick)) (0 (0 tick))))',
                      '(seed (tick (0 tick)))',
                      '(seed (tick (0 tick)))'])
    assert.deepEqual(atomHeaded,
                     ['(0 (0 (next (next seed))))',
                      '((0 (0 (next (0 (0 (next 0)))))) ' +
                        '(0 (next (next seed))))',
                      '((((0 0) 0) (next (0 (0 (next 0))))) ' +
                        '(0 (next (next seed))))'])
  })

  test('keeps nested generated self-application finite', () =>
    assert.equal(serialize(compile(`
      (defn F (x) (x (x x)))
      (F F)
    `)), '((0 (0 0)) 0)'))

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

    assert.deepEqual(tree, parseTerm('((a b) (a b))'))
    assert.notStrictEqual(tree[0], tree[1])
  })

  test('rejects programs without a final expression', t =>
    assertCompileError(t,
                       '(def I (() 0))',
                       /must end with an expression/i))

  test('rejects non-list defn params', t =>
    assertCompileError(t,
                       '(defn I x x)\n(I a)',
                       /params must be a list/i))

  test('rejects short def forms', t =>
    assertCompileError(t, '(def I)\nI', /def name body/i))

  test('rejects short defn forms', t =>
    assertCompileError(t, '(defn I (x))\n(I a)', /defn name/i))

  test('rejects non-symbol def names', t =>
    assertCompileError(t, '(def 0 a)\na', /def name must be a symbol/i))

  test('rejects non-symbol defn names', t =>
    assertCompileError(t,
                       '(defn 0 (x) x)\n(0 a)',
                       /defn name must be a symbol/i))

  test('rejects non-symbol defn params', t =>
    assertCompileError(t,
                       '(defn I (x 0) x)\n(I a)',
                       /params must be symbols/i))

  test('rejects sparse numeric slot templates', t =>
    assertCompileError(t,
                       '(def bad (0 2))\n(((bad a) b) c)',
                       /dense slots/i))

  test('rejects negative numeric slot templates', t =>
    assertCompileError(t,
                       '(def bad (0 -1))\n((bad a) b)',
                       /non-negative integer/i))

  test('rejects non-integer numeric slot templates', t =>
    assertCompileError(t,
                       '(def bad (0 1.5))\n((bad a) b)',
                       /non-negative integer/i))

  test('rejects recursive definitions', t =>
    assertCompileError(t,
                       '(def loop loop)\nloop',
                       /recursive definitions/i))

  test('rejects recursive function aliases during application', t =>
    assertCompileError(t,
                       '(def loop loop)\n(loop a)',
                       /recursive definitions/i))
})
