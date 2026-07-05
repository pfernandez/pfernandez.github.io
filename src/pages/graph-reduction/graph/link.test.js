import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { link, observe } from './index.js'

const atom = '(() ())'
const bind = form => `(${form})`
const ref = depth =>
  '('.repeat(depth + 1) + '()' + ')'.repeat(depth + 1)

const I = `((${ref(0)} ${bind(atom)}) ${ref(0)})`
const K = `(((${ref(0)} ${bind(atom)}) ${bind(atom)}) ${ref(1)})`
const S =
  `((((${ref(0)} ${bind(atom)}) ${bind(atom)}) ${bind(atom)}) ` +
  `((${ref(2)} ${ref(0)}) (${ref(1)} ${ref(0)})))`
const Y =
  `((${ref(0)} ${bind(atom)}) (${ref(0)} (${ref(1)} ${ref(0)})))`
const Zero =
  `(((${ref(0)} ${bind(atom)}) ${bind(atom)}) ${ref(0)})`
const Succ =
  `((((${ref(0)} ${bind(atom)}) ${bind(atom)}) ${bind(atom)}) ` +
  `(${ref(1)} ((${ref(2)} ${ref(1)}) ${ref(0)})))`

const program = (definitions, expression) =>
  `(${definitions.reduceRight(
    (rest, definition) => `(${bind(definition)} ${rest})`,
    '()')} ${expression})`

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
  test('links () to its enclosing pair', () => {
    const { graph, legend, error } = link(`(() ${atom})`)

    assert.equal(error, undefined)
    assert.deepEqual(legend, [])
    assert.equal(graph[0], graph)
    assert.equal(observe(graph), graph[1])
    assert.equal(graph[1][0], graph[1])
    assert.equal(graph[1][1], graph[1])
  })

  test('binds unary forms and addresses them by depth', () => {
    const source = program([atom, atom], `(${ref(1)} ${ref(0)})`)
    const { graph, error } = link(source)

    assert.doesNotMatch(source, /[^()\s]/)
    assert.equal(error, undefined)
    const first = graph[0][0]
    const second = graph[0][1][0]
    assert.notEqual(first, second)
    assert.equal(graph[1][0], first)
    assert.equal(graph[1][1], second)
  })

  test('wires the combinator graph by identity', () => {
    const expression = `(((${ref(0)} ${atom}) ${atom}) ${atom})`
    const { graph, error } = link(program([I, K, S], expression))

    assert.equal(error, undefined)
    const linkedI = graph[0][0]
    const linkedK = graph[0][1][0]
    const linkedS = graph[0][1][1][0]

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
    const definitions = [I, K, S]

    for (const [expression, stable] of [
      [`(${ref(2)} ${atom})`, false],
      [`(${ref(1)} ${atom})`, true],
      [`((${ref(1)} ${atom}) ${atom})`, false],
      [`((${ref(0)} ${atom}) ${atom})`, true],
      [`(((${ref(0)} ${atom}) ${atom}) ${atom})`, false]
    ]) {
      const { graph, error } = link(program(definitions, expression))
      assert.equal(error, undefined)
      const result = observe(graph[1])
      assert.equal(result === graph[1], stable)
    }
  })

  test('answers calls created by copies', () => {
    const expression =
      `(((${ref(0)} ${ref(1)}) ${ref(1)}) ${atom})`
    const { graph, error } = link(program([I, K, S], expression))
    assert.equal(error, undefined)

    const argument = graph[1][1]
    const first = observe(graph[1])
    assert.equal(observe(first), argument)
  })

  test('copies enclosing pairs with their arguments', () => {
    const F = `((${ref(0)} ${bind(atom)}) (() ${ref(0)}))`
    const { graph, error } =
      link(program([F], `(${ref(0)} ${atom})`))

    assert.equal(error, undefined)
    const argument = graph[1][1]
    const result = observe(graph[1])
    assert.equal(result[0], result)
    assert.equal(result[1], argument)
    assert.equal(observe(result), argument)
  })

  test('ties recursive calls into an unbounded observation cycle', () => {
    const { graph, error } =
      link(program([I, Y], `(${ref(0)} ${ref(1)})`))
    assert.equal(error, undefined)

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
      let numeral = ref(1)
      for (let i = 0; i < n; i++)
        numeral = `(${ref(0)} ${numeral})`

      const expression =
        `((${numeral} ${ref(2)}) ${atom})`
      const { graph, error } =
        link(program([I, Zero, Succ], expression))
      assert.equal(error, undefined)

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
