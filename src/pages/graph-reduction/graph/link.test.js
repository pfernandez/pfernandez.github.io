import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  link,
  observe,
  serialize
} from './index.js'

const identity = symbol => `(${symbol} (${symbol} ${symbol}))`

const I = `(I ((I ${identity('x')}) x))`
const K = `(K (((K ${identity('x')}) ${identity('y')}) x))`
const S =
  `(S ((((S ${identity('x')}) ${identity('y')}) ` +
  `${identity('z')}) ((x z) (y z))))`
const Y = `(Y ((Y ${identity('f')}) (f (Y f))))`
const Zero =
  `(Zero (((Zero ${identity('f')}) ${identity('x')}) x))`
const Succ =
  `(Succ ((((Succ ${identity('n')}) ${identity('f')}) ` +
  `${identity('x')}) (f ((n f) x))))`

const program = (definitions, expression) =>
  `(${definitions.reduceRight(
    (rest, definition) => `(${definition} ${rest})`,
    '()')} ${expression})`

const coreDefinitions = [
  I,
  K,
  S,
  ...['a', 'b', 'c', 'd'].map(identity)
]
const withCore = expression => program(coreDefinitions, expression)
const linkedCore =
  '(I (K (S (a (b (c (d $.0.1.1.1.1.1.1)))))))'
const core = withCore('((K a) b)')

const named = legend => Object.fromEntries(
  legend.map(({ node, symbol }, index) => [`${symbol}${index}`, node]))

describe('link', () => {
  test('links () to its enclosing pair', () => {
    const { graph, legend, error } = link('(() (a (a a)))')

    assert.equal(error, undefined)
    assert.equal(graph[0], graph)
    assert.equal(observe(graph), graph[1])
    assert.equal(serialize(graph, { legend, expand: false }), '($ a)')
  })

  test('links source text', () => {
    const { graph, legend, error } = link(core)

    assert.equal(error, undefined)
    assert.equal(
      serialize(graph, { legend, expand: false }),
      `(${linkedCore} ((K a) b))`)
  })

  test('wires the current core graph', () => {
    const { graph, legend, error } = link(core)
    assert.equal(error, undefined)

    const {
      I0: I,
      x1: Ix,
      K2: K,
      x3: Kx,
      y4: Ky,
      S5: S,
      x6: Sx,
      y7: Sy,
      z8: Sz,
      a9: a,
      b10: b,
      c11: c,
      d12: d,
      K13: appliedK
    } = named(legend)

    assert.equal(
      serialize(graph, { legend, expand: false }),
      `(${linkedCore} ((K a) b))`)
    assert.deepEqual(
      legend.map(({ symbol }) => symbol),
      ['I', 'x', 'K', 'x', 'y', 'S', 'x', 'y', 'z',
        'a', 'b', 'c', 'd', 'K'])

    assert.equal(graph[0][0], I)
    assert.equal(graph[0][1][0], K)
    assert.equal(graph[0][1][1][0], S)
    assert.equal(graph[1][0][0], appliedK)
    assert.equal(graph[1][0][1], a)
    assert.equal(graph[1][1], b)
    assert.notEqual(appliedK, K)
    assert.equal(appliedK[0], appliedK)
    assert.equal(appliedK[1], a)

    assert.equal(I[0][0], I)
    assert.equal(I[0][1], Ix)
    assert.equal(I[1], Ix)

    assert.equal(K[0][0][0], K)
    assert.equal(K[0][0][1], Kx)
    assert.equal(K[0][1], Ky)
    assert.equal(K[1], Kx)

    assert.equal(S[0][0][0][0], S)
    assert.equal(S[0][0][0][1], Sx)
    assert.equal(S[0][0][1], Sy)
    assert.equal(S[0][1], Sz)
    assert.equal(S[1][0][0], Sx)
    assert.equal(S[1][0][1], Sz)
    assert.equal(S[1][1][0], Sy)
    assert.equal(S[1][1][1], Sz)

    for (const node of [Ix, Kx, Ky, Sx, Sy, Sz, a, b, c, d]) {
      assert.equal(node[0], node)
      assert.equal(node[1], node)
    }
  })

  test('copies complete calls and preserves partial calls', () => {
    for (const [expression, expected] of [
      ['(I a)', 'a'],
      ['(K a)', '(K a)'],
      ['((K a) b)', 'a'],
      ['(((K a) b) c)', '(a c)'],
      ['((S a) b)', '((S a) b)'],
      ['(((S a) b) c)', '((a c) (b c))']
    ]) {
      const { graph, legend, error } = link(withCore(expression))
      assert.equal(error, undefined)
      assert.equal(
        serialize(observe(graph[1]), { legend, expand: false }),
        expected)
      assert.equal(
        serialize(graph, { legend, expand: false }),
        `(${linkedCore} ${expression})`)
    }

    const partial = link(withCore('((S a) b)'))
    assert.equal(observe(partial.graph[1]), partial.graph[1])

    const { graph, legend } = link(withCore('(((S a) b) c)'))
    const result = observe(graph[1])
    const value = symbol => legend.findLast(entry => entry.symbol === symbol).node
    assert.deepEqual(
      [result[0][0], result[0][1], result[1][0], result[1][1]],
      [value('a'), value('c'), value('b'), value('c')])
  })

  test('answers calls created by copies', () => {
    for (const [expression, first, second] of [
      ['(((S K) K) a)', '((K a) (K a))', 'a'],
      ['((I I) a)', '(I a)', 'a']
    ]) {
      const { graph, legend, error } = link(withCore(expression))
      assert.equal(error, undefined)
      const result = observe(graph[1])
      assert.equal(serialize(result, { legend, expand: false }), first)
      assert.equal(
        serialize(observe(result), { legend, expand: false }),
        second)
    }

    const T = `(T ((T ${identity('x')}) (I x)))`
    const { graph, legend, error } =
      link(program([I, T, identity('a')], '(T a)'))
    assert.equal(error, undefined)
    const result = observe(graph[1])
    assert.equal(serialize(result, { legend, expand: false }), '(I a)')
    assert.equal(serialize(observe(result), { legend, expand: false }), 'a')

    const partialT = `(T ((T ${identity('x')}) (K x)))`
    const partial =
      link(program([K, partialT, identity('a')], '(T a)'))
    const partialResult = observe(partial.graph[1])
    assert.equal(observe(partialResult), partialResult)
  })

  test('ties recursive calls into an unbounded observation cycle', () => {
    const { graph, legend, error } = link(program([I, Y], '(Y I)'))
    assert.equal(error, undefined)

    const first = observe(graph[1])
    const second = observe(first)
    const third = observe(second)
    assert.equal(serialize(first, { legend, expand: false }), '(I (Y I))')
    assert.equal(serialize(second, { legend, expand: false }), '(Y I)')
    assert.equal(serialize(third, { legend, expand: false }), 'Y')
    assert.equal(observe(third), first)

    let result = third
    for (let i = 0; i < 999; i++)
      result = observe(result)
    assert.equal(result, third)
  })

  test('composes Church successors', () => {
    for (let n = 0; n < 4; n++) {
      let numeral = 'Zero'
      for (let i = 0; i < n; i++)
        numeral = `(Succ ${numeral})`

      const { graph, legend, error } =
        link(program(
          [I, Zero, Succ, identity('a')],
          `((${numeral} I) a)`))
      assert.equal(error, undefined)

      let result = graph[1]
      let steps = 0
      do {
        const next = observe(result)
        steps += 1
        if (next === result) break
        result = next
      } while (steps < 16)

      assert.equal(serialize(result, { legend, expand: false }), 'a')
      assert.equal(steps, 2 * n + 2)
    }
  })
})
