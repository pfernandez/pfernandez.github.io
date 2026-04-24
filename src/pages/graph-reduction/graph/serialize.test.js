import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from '../observer/observe.js'
import { compile, parse, serialize } from './index.js'

const parseTerm = source => parse(source)[0]

describe('pair serializer', () => {
  test('serialize writes canonical atoms and pairs', () => {
    assert.equal(serialize('foo'), 'foo')
    assert.equal(serialize(42), '42')
    assert.equal(serialize([]), '()')
    assert.equal(serialize([[], 'x']), '(() x)')
    assert.equal(serialize([['a', 'b'], ['c', ['d', 'e']]]),
                 '((a b) (c (d e)))')
  })

  test('serialize round-trips parsed terms', () =>
    ['foo',
     '42',
     '()',
     '(a b)',
     '((() a) (() b))',
     '; comment\n((a b) ; inline\n (c d))'].forEach(source => {
      const pair = parseTerm(source)
      assert.deepEqual(parseTerm(serialize(pair)), pair)
    }))

  test('serialize rejects malformed arrays', () => {
    assert.throws(() => serialize(['a']), /empty or pairs/i)
    assert.throws(() => serialize(['a', 'b', 'c']), /empty or pairs/i)
  })

  test('serialize writes numeric slot motifs', () =>
    assert.equal(serialize([[[[[0, 2], [1, 2]], 'a'], 'b'], 'c']),
                 '(((((0 2) (1 2)) a) b) c)'))

  test('serialize projects compiled slots as folding instructions', () =>
    assert.equal(serialize(compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)), '(((((0 2) (1 2)) a) b) c)'))

  test('serialize shows S frames with one hidden shared c', () => {
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
    assert.equal(step3, step2)
    assert.equal(serialize(step0), '(((((0 2) (1 2)) a) b) c)')
    assert.equal(serialize(step1), '((((a 1) (0 1)) b) c)')
    assert.equal(serialize(step2), '((a c) (b c))')
  })

  test('serialize labels raw fixed points by traversal order', () => {
    const point = []
    point[0] = point
    point[1] = 'a'

    assert.equal(serialize(point), '0')
  })

  test('serialize fills inactive closures inside projections', () => {
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

  test('serialize rejects malformed arrays inside projections', () => {
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

  test('serialize fills closures hidden behind atom heads', () => {
    const empty = compile('(defn I (x) x)\n(x (I ()))')
    const malformed = compile('(defn I (x) x)\n(x (I (a b)))')

    assert.equal(serialize(empty), '(x ())')
    malformed[1][1].pop()
    assert.throws(() => serialize(malformed), /empty or pairs/i)
  })
})
