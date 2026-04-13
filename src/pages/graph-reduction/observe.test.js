import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parse, parseProgram } from './sexpr.js'
import { observe } from './observe.js'

const reduce = (source, maxSteps = 16) => {
  let term = parseProgram(source)

  for (let i = 0; i < maxSteps; i++) {
    const next = observe(term)
    if (next === term) return next
    term = next
  }

  throw new Error(`Did not settle after ${maxSteps} steps: ${source}`)
}

describe('observe', () => {
  const lambda = [[], 'a']
  const stable = ['a', 'b']

  test('leaves (() a) alone', () => {
    assert.deepStrictEqual(observe(lambda), lambda)
  })

  test('applies (() a) to b', () =>
    assert.strictEqual(observe([lambda, 'b']), 'a'))

  test('keeps the outer pair when the left side steps', () =>
    assert.deepStrictEqual(observe([[lambda, 'b'], 'c']), ['a', 'c']))

  test('preserves referential identity when nothing changes', () => {
    assert.deepStrictEqual(observe(stable), stable)
    assert.deepStrictEqual(observe([stable, 'c']), [stable, 'c'])
  })

  test('does not reduce the right branch', () => {
    const root = ['x', []]
    assert.deepStrictEqual(observe(root)[1], root[1])
  })

  test('leaves a plain atom alone', () => {
    assert.strictEqual(observe('a'), 'a')
  })

  test('returns the same pair when no reduction occurs', () =>
    assert.deepStrictEqual(observe(stable), stable))
})

describe('what basis does', () => {
  test('keeps b after reducing identity', () =>
    assert.deepStrictEqual(reduce(`
      (defn I (x) x)
      ((I a) b)
    `), parse('(a b)')))

  test('keeps both copies of c in S', () =>
    assert.deepStrictEqual(
      reduce(`
        (defn S (x y z) ((x z) (y z)))
        (((S a) b) c)
      `),
      parse('((a c) (b c))')
    ))

  test('does not collapse (() a) on sight', () =>
    assert.deepStrictEqual(reduce('(() a)'), parse('(() a)')))
})

describe('program stepping', () => {
  test('feeds a, then b, then c through wrapped S', () => {
    const source = parseProgram(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `)

    const afterA = observe(source)
    assert.deepEqual(afterA, parse('(((() (() ((a 1) (0 1)))) b) c)'))

    const afterB = observe(afterA)
    assert.deepEqual(afterB, parse('((() ((a 0) (b 0))) c)'))

    const afterC = observe(afterB)
    assert.deepEqual(afterC, parse('((a c) (b c))'))
  })

  test('instantiates I without forcing the outer argument', () => {
    const source = parseProgram(`
      (defn I (x) x)
      ((I a) b)
    `)

    assert.deepEqual(observe(source), parse('(a b)'))
  })
})
