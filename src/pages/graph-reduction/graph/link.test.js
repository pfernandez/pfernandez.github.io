import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { link, observe } from './index.js'

const I = '((I x) x)'
const K = '((K x y) x)'
const S = '((S x y z) ((x z) (y z)))'
const Y = '((Y f) (f (Y f)))'
const Zero = '((Zero f x) x)'
const Succ = '((Succ n f x) (f (n f x)))'

const program = (definitions, expression) =>
  `((${definitions.join('\n')}) ${expression})`

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

const named = (legend, symbol) =>
  legend.find(entry => entry.symbol === symbol).node

const assertPairs = root => {
  const pending = [root]
  const seen = new Set()

  while (pending.length) {
    const pair = pending.pop()
    if (seen.has(pair)) continue
    seen.add(pair)
    assert.equal(Array.isArray(pair), true)
    assert.equal(pair.length, 2)
    pending.push(pair[0], pair[1])
  }
}

describe('link', () => {
  test('links a program without definitions', () => {
    const { graph, legend } = linked('(() a)')

    assert.equal(graph[0], graph)
    assert.equal(observe(graph), named(legend, 'a'))
    assertPairs(graph)
  })

  test('wires the combinator graph by identity', () => {
    const { graph, legend } =
      linked(program([I, K, S], '(S a b c)'))
    const linkedI = named(legend, 'I')
    const linkedK = named(legend, 'K')
    const linkedS = named(legend, 'S')

    assert.equal(linkedI[0][0], linkedI)
    assert.equal(linkedI[0][1], linkedI[1])
    assert.equal(linkedK[0][0][0], linkedK)
    assert.equal(linkedK[0][0][1], linkedK[1])
    assert.equal(linkedS[0][0][0][0], linkedS)

    const result = observe(graph[1])
    assert.equal(result[0][1], result[1][1])
    assertPairs(graph)
  })

  test('copies complete calls and preserves partial calls', () => {
    for (const [expression, stable] of [
      ['(I a)', false],
      ['(K a)', true],
      ['(K a b)', false],
      ['(S a b)', true],
      ['(S a b c)', false]
    ]) {
      const { graph } = linked(program([I, K, S], expression))
      assert.equal(observe(graph[1]) === graph[1], stable)
    }
  })

  test('answers calls created by copies', () => {
    const { graph } = linked(program([I, K, S], '(S K K a)'))
    const argument = graph[1][1]
    const first = observe(graph[1])

    assert.equal(observe(first), argument)
  })

  test('ties recursive calls into an unbounded observation cycle', () => {
    const { graph } = linked(program([I, Y], '(Y I)'))

    const first = observe(graph[1])
    const second = observe(first)
    const third = observe(second)
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

      const { graph } =
        linked(program([I, Zero, Succ], `(${numeral} I a)`))

      let result = graph[1]
      let steps = 0
      do {
        const next = observe(result)
        steps += 1
        if (next === result) break
        result = next
      } while (steps < 16)

      assert.equal(result[0], result)
      assert.equal(result[1], result)
      assert.equal(steps, 2 * n + 2)
    }
  })
})
