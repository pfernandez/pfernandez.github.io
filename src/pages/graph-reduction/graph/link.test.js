import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { image } from '../wasm/image.js'
import { link, step } from './index.js'

const I = '(I x x)'
const K = '(K x y x)'
const S = '(S x y z ((x z) (y z)))'
const B = '(B f g x (f (g x)))'
const C = '(C f x y ((f y) x))'
const W = '(W f x ((f x) x))'
const M = '(M x (x x))'
const Observe = '(Observe x next (x next))'
const Y = '(Y f (f (Y f)))'
const True = '(True x y x)'
const False = '(False x y y)'
const If = '(If p x y (p x y))'
const Not = '(Not p (p False True))'
const Pair = '(Pair x y f (f x y))'
const First = '(First p (p K))'
const Second = '(Second p (p False))'
const Zero = '(Zero f x x)'
const Succ = '(Succ n f x (f (n f x)))'

const Core = [
  I, K, S, B, C, W, M, Y, True, False, If, Not, Pair, First, Second
]

const Library = '(Library use (use I K S))'
const ApplyS = '(ApplyS i k s (s a b c))'
const Query = '(Query library (library ApplyS))'
const Loop = '(Loop library question self (Observe (question library) self))'

const program = (definitions, expression) =>
  `(${definitions.join('\n')} ${expression})`

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

const named = (legend, symbol) =>
  legend.findLast(entry => entry.symbol === symbol).node

const steps = (graph, count) => {
  let result = graph
  for (let i = 0; i < count; i++) result = step(result)
  return result
}

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

const assertS = ({ result, legend }) => {
  assert.equal(result[0][0], named(legend, 'a'))
  assert.equal(result[0][1], named(legend, 'c'))
  assert.equal(result[1][0], named(legend, 'b'))
  assert.equal(result[1][1], named(legend, 'c'))
}

const assertApplication = (result, left, right) => {
  assert.equal(result[0], left)
  assert.equal(result[1], right)
}

const find = (root, predicate) => {
  const pending = [root]
  const seen = new Set()

  while (pending.length) {
    const node = pending.pop()
    if (seen.has(node)) continue
    seen.add(node)
    if (predicate(node)) return node
    if (Array.isArray(node)) pending.push(node[0], node[1])
  }
}

describe('link', () => {
  test('links a bare atom', () => {
    const { graph, legend } = linked('a')

    assert.equal(graph[0], graph)
    assert.equal(step(graph), graph)
    assert.equal(graph, named(legend, 'a'))
    assertPairs(graph)
  })

  test('links the source shape and reaches the S answer', () => {
    const { graph, legend } = linked(program([I, K, S], '(S a b c)'))
    const result = steps(graph, 2)

    assertS({ result, legend })
    assertPairs(graph)
    assert.doesNotThrow(() => image(graph))
  })

  test('keeps partial calls visible until enough arguments arrive', () => {
    for (const [expression, stable] of [
      ['(I a)', false],
      ['(K a)', true],
      ['(K a b)', false],
      ['(S a b)', true],
      ['(S a b c)', false]
    ]) {
      const { graph } = linked(program([I, K, S], expression))
      const focus = step(graph)
      assert.equal(step(focus) === focus, stable)
    }
  })

  test('answers calls created by copied bodies', () => {
    const { graph, legend } = linked(program([I, K, S], '(S K K a)'))

    assert.equal(steps(graph, 3), named(legend, 'a'))
    assertPairs(graph)
  })

  test('links the basic combinator library', () => {
    const cases = [
      ['(B f g x)', (result, legend) => {
        assert.equal(result[0], named(legend, 'f'))
        assertApplication(result[1], named(legend, 'g'), named(legend, 'x'))
      }],
      ['(C f x y)', (result, legend) => {
        assertApplication(result[0], named(legend, 'f'), named(legend, 'y'))
        assert.equal(result[1], named(legend, 'x'))
      }],
      ['(W f x)', (result, legend) => {
        assertApplication(result[0], named(legend, 'f'), named(legend, 'x'))
        assert.equal(result[1], named(legend, 'x'))
      }],
      ['(M x)', (result, legend) =>
        assertApplication(result, named(legend, 'x'), named(legend, 'x'))]
    ]

    const { graph, legend } = linked(program(Core, cases[0][0]))
    cases[0][1](steps(graph, 2), legend)
    assertPairs(graph)

    for (const [expression, assertResult] of cases.slice(1)) {
      const { graph, legend } = linked(program(Core, expression))
      assertResult(steps(graph, 2), legend)
      assertPairs(graph)
    }
  })

  test('links booleans and pair selectors', () => {
    for (const [expression, expected, count] of [
      ['(True a b)', 'a', 2],
      ['(False a b)', 'b', 2],
      ['(Not True)', 'False', 3],
      ['(Not False)', 'True', 3],
      ['(First (Pair a b))', 'a', 4],
      ['(Second (Pair a b))', 'b', 4]
    ]) {
      const { graph, legend } = linked(program(Core, expression))

      assert.equal(steps(graph, count), named(legend, expected))
      assertPairs(graph)
    }

    const ifLinked = linked(program(Core, '(If p a b)'))
    const ifResult = steps(ifLinked.graph, 2)

    assertApplication(
      ifResult[0],
      named(ifLinked.legend, 'p'),
      named(ifLinked.legend, 'a'))
    assert.equal(ifResult[1], named(ifLinked.legend, 'b'))
    assertPairs(ifLinked.graph)

    const pairLinked = linked(program(Core, '(Pair a b f)'))
    const pairResult = steps(pairLinked.graph, 2)

    assertApplication(
      pairResult[0],
      named(pairLinked.legend, 'f'),
      named(pairLinked.legend, 'a'))
    assert.equal(pairResult[1], named(pairLinked.legend, 'b'))
    assertPairs(pairLinked.graph)
  })

  test('lets a binary name point directly at a live future', () => {
    const { graph, legend } = linked(program([I, S], '(Root (S a b c))'))
    const future = step(graph)
    const result = step(future)

    assert.equal(future, named(legend, 'Root'))
    assertS({ result, legend })
    assertPairs(graph)
  })

  test('keeps root self-reference pair-pure', () => {
    const { graph, legend } = linked(`
      (Loop
        ((S x y z ((x z) (y z))) (S a b c)
         Loop))
    `)

    assert.equal(graph, named(legend, 'Loop'))
    assert.equal(step(graph), graph)
    assertPairs(graph)
    assert.doesNotThrow(() => image(graph))
  })

  test('links the graph-native core source to an image-safe graph', () => {
    const source = readFileSync(
      new URL('../core.graph.lisp', import.meta.url),
      'utf-8')
    const { graph, legend } = linked(source)

    assertS({ result: steps(graph, 2), legend })
    assertPairs(graph)
    assert.doesNotThrow(() => image(graph))
  })

  test('can write an observer state in source', () => {
    const { graph, legend } = linked(program([
      Observe,
      S,
      'a',
      'b',
      'c',
      '(Done ((a c) (b c)) Done)'
    ], '(Observe (S a b c) Done)'))
    const event = steps(graph, 2)
    const done = step(event)
    const answer = event[0][1]

    assertS({ result: answer, legend })
    assertS({ result: done[0], legend })
    assert.equal(done, named(legend, 'Done'))
    assert.equal(step(done), done)
    assertPairs(graph)
  })

  test('carries a library through a source loop', () => {
    const { graph, legend } = linked(program([
      I,
      K,
      S,
      Observe,
      Y,
      Library,
      ApplyS,
      Query,
      Loop
    ], '(Y (Loop Library Query))'))
    const visible = steps(graph, 4)
    const answer = find(visible, node =>
      Array.isArray(node)
      && Array.isArray(node[0])
      && Array.isArray(node[1])
      && node[0][0] === named(legend, 'a')
      && node[0][1] === named(legend, 'c')
      && node[1][0] === named(legend, 'b')
      && node[1][1] === named(legend, 'c'))

    assert.equal(steps(graph, 7), steps(graph, 2))
    assert.equal(steps(graph, 8), steps(graph, 3))
    assert.equal(find(visible, node => node === named(legend, 'Library')),
                 named(legend, 'Library'))
    assert.ok(answer)
    assertPairs(graph)
  })

  test('ties recursive calls into an unbounded step cycle', () => {
    const { graph } = linked(program([I, Y], '(Y I)'))

    const first = step(graph)
    const second = step(first)
    const third = step(second)
    const fourth = step(third)
    assert.equal(step(fourth), second)

    let result = fourth
    for (let i = 0; i < 999; i++) result = step(result)
    assert.equal(result, fourth)
    assertPairs(graph)
  })

  test('composes Church successors', () => {
    for (let n = 0; n < 4; n++) {
      let numeral = 'Zero'
      for (let i = 0; i < n; i++) numeral = `(Succ ${numeral})`

      const { graph } =
        linked(program([I, Zero, Succ], `(${numeral} I a)`))

      let result = graph
      let count = 0
      do {
        const next = step(result)
        count += 1
        if (next === result) break
        result = next
      } while (count < 16)

      assert.equal(result[0], result)
      assert.equal(result[1], result)
      assert.equal(count, 2 * n + 3)
      assertPairs(graph)
    }
  })
})
