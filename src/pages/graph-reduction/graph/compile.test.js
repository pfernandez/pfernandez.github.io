import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  observe,
  serialize
} from './index.js'

describe('compiler wiring', () => {
  test('makes every pair a complete graph', () => {
    const { graph, legend } = compile('(I (x (a a)))')
    const I = graph
    const x = I[1]
    const a = x[1]

    assert.equal(serialize(graph, { legend }), 'I')
    assert.equal(I[0], I)
    assert.equal(x[0], x)
    assert.equal(a[0], a)
    assert.equal(a[1], a)
    assert.equal(observe(I), x)
    assert.equal(observe(x), a)
    assert.equal(observe(a), a)
    assert.deepEqual(legend.map(([, name]) => name), ['a', 'x', 'I'])
  })

  test('the root is referenced by the result pointing to an atom', () => {
    const { graph, legend } = compile('(((I x) x) (I a))')
    const I = graph[0]
    const x = I[0]
    const result = graph[1]
    const a = result[1]

    assert.equal(I[1], x)
    assert.equal(x[0], I)
    assert.equal(x[1], x)
    assert.equal(result[0], graph)
    assert.equal(a[0], a)
    assert.equal(a[1], a)
    assert.equal(observe(graph), result)
    assert.equal(observe(result), a)
    assert.deepEqual(legend.map(([, name]) => name), ['x', 'I', 'a'])
  })

  test('left spine definitions can have multiple arguments', () => {
    const { graph: K, legend } = compile('(((K x) y) x)')
    const y = K[0]
    const x = K[1]

    assert.equal(x[0], K)
    assert.equal(x[1], x)
    assert.equal(y[0], x)
    assert.equal(y[1], y)
    assert.deepEqual(legend.map(([, name]) => name), ['x', 'y', 'K'])
  })

  test('K links back to its first input', () => {
    const { graph: K, legend } = compile('(K (x (y x)))')
    const x = K[1]
    const y = x[1]

    assert.equal(K[0], K)
    assert.equal(x[0], x)
    assert.equal(y[0], y)
    assert.equal(y[1], x)
    assert.deepEqual(legend.map(([, name]) => name), ['y', 'x', 'K'])
  })

  test('S shares its third input between both branches', () => {
    const { graph: S, legend } =
      compile('(S (x (y (z ((x z) (y z))))))')
    const x = S[1]
    const y = x[1]
    const z = y[1]
    const [xz, yz] = z[1]

    assert.equal(xz[0], x)
    assert.equal(xz[1], z)
    assert.equal(yz[0], y)
    assert.equal(yz[1], z)
    assert.deepEqual(legend.map(([, name]) => name), ['z', 'y', 'x', 'S'])
  })

  test('returns an error when source does not compile', () => {
    const { graph, legend, error } = compile('(')

    assert.deepEqual(graph, [])
    assert.deepEqual(legend, [])
    assert.match(error.message, /Missing \)/)
  })
})
