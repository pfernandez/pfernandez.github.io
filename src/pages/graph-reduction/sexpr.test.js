import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { collapse } from './collapse.js'
import { parse, resolve, serialize } from './sexpr.js'

const normalizeCollapse = pair => {
  const steps = []
  let current = pair

  while (true) {
    const next = collapse(current)
    if (next === current) return { after: current, steps }
    steps.push(next)
    current = next
  }
}

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
  test('resolves ((0 2) (1 2)) with fill-order slots', () => {
    const term = parse('(((((0 2) (1 2)) a) b) c)')
    assert.deepEqual(resolve(term),
                     [['a', 'c'],
                      ['b', 'c']])
  })

  test('leaves extra applied args outside the resolved motif', () => {
    const term = parse('((((((0 2) (1 2)) a) b) c) d)')
    assert.deepEqual(resolve(term),
                     [[['a', 'c'],
                       ['b', 'c']],
                      'd'])
  })

  test('reuses the same argument object at repeated slots', () => {
    const term = parse('(((((0 2) (1 2)) a) b) (u v))')
    const out = resolve(term)
    assert.deepEqual(out,
                     [['a', ['u', 'v']],
                      ['b', ['u', 'v']]])
    assert.equal(out[0][1], out[1][1])
  })
})

describe('motifs', () => {
  test('the expanded S scaffold collapses to the compact S motif', () => {
    const expanded = parse('((((() (() (() ((0 2) (1 2))))) a) b) c)')
    const normalized = normalizeCollapse(expanded)

    assert.deepEqual(
      normalized.steps,
      [parse('((((() (() ((0 2) (1 2)))) a) b) c)'),
       parse('((((() ((0 2) (1 2))) a) b) c)'),
       parse('(((((0 2) (1 2)) a) b) c)')]
    )
    assert.deepEqual(normalized.after,
                     parse('(((((0 2) (1 2)) a) b) c)'))
  })

  test('expanded and compact S resolve to the same term', () => {
    const expanded = parse('((((() (() (() ((0 2) (1 2))))) a) b) c)')
    const compact = parse('(((((0 2) (1 2)) a) b) c)')

    assert.deepEqual(resolve(normalizeCollapse(expanded).after),
                     resolve(compact))
  })
})

describe('K boundary', () => {
  test('an unused second argument is not consumed by indices alone', () => {
    const oneArg = parse('(0 a)')
    const twoArgs = parse('((0 a) b)')

    assert.equal(resolve(oneArg), 'a')
    assert.equal(resolve(twoArgs), twoArgs)
  })
})

describe('identity', () => {
  test('0 is identity at the resolve layer', () => {
    assert.equal(resolve(parse('(0 x)')), 'x')
  })

  test('(() 0) composes resolve-identity with collapse-identity', () => {
    const resolved = resolve(parse('((() 0) x)'))

    assert.deepEqual(resolved, [[], 'x'])
    assert.equal(collapse(resolved), 'x')
  })
})
