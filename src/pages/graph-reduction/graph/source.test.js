import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link, observe } from './index.js'

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

const resultOf = source => {
  const { graph, legend, error } = link(source)
  if (error) throw error
  assertPairs(graph)
  return { result: observe(graph[1]), legend }
}

const assertS = ({ result, legend }) => {
  const named = symbol =>
    legend.findLast(entry => entry.symbol === symbol).node

  assert.equal(result[0][0], named('a'))
  assert.equal(result[0][1], named('c'))
  assert.equal(result[1][0], named('b'))
  assert.equal(result[1][1], named('c'))
}

test('links explicit lexical names', () => {
  const linked = resultOf(`
  (
   ((I ((I (x (() ()))) x))
    ())
   (I (a (() ())))
  )
  `)

  assert.deepEqual(
    linked.legend.map(entry => entry.symbol),
    ['I', 'x', 'a'])
  assert.equal(linked.result, linked.legend[2].node)
})

test('folds signatures and applications before linking names', () => {
  const linked = resultOf(`
  (
   (((I x) x)
    ((K x y) x)
    ((S x y z) ((x z) (y z))))
   (S a b c)
  )
  `)

  assert.deepEqual(
    linked.legend.map(entry => entry.symbol),
    ['I', 'x', 'K', 'x', 'y', 'S', 'x', 'y', 'z', 'a', 'b', 'c'])
  assertS(linked)
})
