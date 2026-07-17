const assert = require('node:assert/strict')
const test = require('node:test')

let material
let serialize

const load = async () => {
  material ??= await import('./conserved-material.mjs')
  serialize ??= (await import('../serialize.mjs')).serialize
}

test('conserved observer reduces hand-built I without allocating pairs', async () => {
  await load()

  const graph = material.I('x')
  const pairs = material.collectPairs(graph)
  const next = material.observe(graph)

  assert.equal(next, 'x')
  assert.equal(material.isConserved(pairs, next), true)
})

test('conserved observer reduces hand-built K without allocating pairs', async () => {
  await load()

  const graph = material.K('x', 'y')
  const pairs = material.collectPairs(graph)
  const next = material.observe(graph)

  assert.equal(next, 'x')
  assert.equal(material.isConserved(pairs, next), true)
})

test('conserved observer reduces hand-built S to normal form without allocating pairs', async () => {
  await load()

  const graph = material.S('x', 'y', 'z')
  const pairs = material.collectPairs(graph)
  const next = material.observe(graph)

  assert.equal(serialize(next), '((x z) (y z))')
  assert.equal(material.isConserved(pairs, next), true)
})

test('conserved Z is a periodic x-carrying orbit', async () => {
  await load()

  const graph = material.Z('x')
  const result = material.orbit(graph, 8)

  assert.equal(result.conserved, true)
  assert.equal(result.cycleStart, 0)
  assert.equal(result.cycleLength, 2)
  assert.match(serialize(result.states[0]), /\bx\b/)
  assert.match(serialize(result.states[1]), /\bx\b/)
})

test('a single self-reference is stable vacuum', async () => {
  await load()

  const graph = []
  graph[0] = graph
  graph[1] = graph

  const result = material.orbit(graph, 4)

  assert.equal(result.conserved, true)
  assert.equal(result.cycleStart, 0)
  assert.equal(result.cycleLength, 1)
  assert.equal(serialize(result.states[0]), '($ $)')
})

test('three pair nodes are enough for pair-only visible recurrence', async () => {
  await load()

  const graph = []
  const next = []
  const again = []

  graph[0] = graph
  graph[1] = next

  next[0] = next
  next[1] = again

  again[0] = graph
  again[1] = graph

  const result = material.orbit(graph, 8)

  assert.equal(material.collectPairs(graph).size, 3)
  assert.equal(result.conserved, true)
  assert.equal(result.cycleStart, 1)
  assert.equal(result.cycleLength, 2)
  assert.notEqual(serialize(result.states[1]), serialize(result.states[2]))
})
