import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link, step } from './index.js'

const namedNodes = root => {
  const pending = [root]
  const seen = new Set()
  const named = []

  while (pending.length) {
    const node = pending.shift()
    if (!Array.isArray(node) || seen.has(node)) continue
    seen.add(node)
    if (node.symbol !== undefined) named.push(node)
    pending.push(...node)
  }

  return named
}

const resultOf = source => {
  const { graph, error } = link(source)
  if (error) throw error
  return { graph, result: step(step(graph)) }
}

const assertS = ({ graph, result }) => {
  const namedNodesInGraph = namedNodes(graph)
  const named = symbol =>
    namedNodesInGraph.findLast(node => node.symbol === symbol)

  assert.equal(result[0][0], named('a'))
  assert.equal(result[0][1], named('c'))
  assert.equal(result[1][0], named('b'))
  assert.equal(result[1][1], named('c'))
}

test('links pair-expanded definitions', () => {
  const linked = resultOf(`
  (((I x) x)
   (((K x) y) x)
   ((((S x) y) z) ((x z) (y z)))
   (((S a) b) c))
  `)

  assert.deepEqual(
    namedNodes(linked.graph).map(node => node.symbol).sort(),
    ['I', 'K', 'S', 'S', 'a', 'b', 'c', 'x', 'x', 'x', 'y', 'y', 'z']
      .sort())
  assertS(linked)
})
