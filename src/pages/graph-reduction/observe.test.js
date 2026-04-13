import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { build, parse } from './sexpr.js'
import { observe } from './observe.js'

const reduce = (source, maxSteps = 16) => {
  let term = build(parse(source))

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

  test('leaves a built identity result alone', () => {
    const graph = build(parse('(0 a)'))
    assert.deepStrictEqual(graph, 'a')
    assert.strictEqual(observe(graph), 'a')
  })

  test('returns the same pair when no reduction occurs', () =>
    assert.deepStrictEqual(observe(stable), stable))
})

describe('what basis does', () => {
  test('keeps b after reducing identity', () =>
    assert.deepStrictEqual(reduce('((0 a) b)'), parse('(a b)')))

  test('keeps both copies of c in S', () =>
    assert.deepStrictEqual(
      reduce('(((((0 2) (1 2)) a) b) c)'),
      parse('((a c) (b c))')
    ))

  test('does not collapse (() a) on sight', () =>
    assert.deepStrictEqual(reduce('(() a)'), parse('(() a)')))
})
