import assert from 'node:assert/strict'
import { test } from 'node:test'
import { connect } from './connect.js'
import { decompose } from './decompose.js'
import { parse } from './parse.js'

const connected = (source, imports) =>
  connect(decompose(parse(source)), imports)

test('connects lexical identities without applying them', () => {
  const { definitions, graph, legend } = connected(`
    ((I x x)
     (I a))
  `)
  const [I, application] = graph

  assert.equal(definitions.has(I), true)
  assert.equal(I[0][0], I[0])
  assert.equal(I[0].length, 1)
  assert.equal(application[0], I)
  assert.equal(legend.get(application[1]).name, 'a')
})

test('connects free identities before composition', () => {
  const { graph } = connected(`
    ((I x x)
     (F x (I x)))
  `)
  const [I, F] = graph

  assert.equal(F[1][0], I)
  assert.equal(F[1][1], F[0])
})

test('lets a top-level value name an application', () => {
  const { calls, definitions, graph, legend, namedValues } = connected(`
    ((I x x)
     (first (I a)))
  `)
  const [I, first] = graph

  assert.equal(first[0], I)
  assert.equal(legend.get(first).name, 'first')
  assert.equal(calls.has(first), true)
  assert.equal(definitions.has(first), false)
  assert.equal(namedValues.has(first), true)
})

test('keeps nested parameters lexical', () => {
  const { graph } = connected(`
    ((F x
       ((G x x)
        x)))
  `)
  const outer = graph[0]
  const [G, following] = graph[1]

  assert.notEqual(G[0], outer)
  assert.equal(G[0], G[1])
  assert.equal(following, outer)
})

test('records imported capabilities in an identity-keyed legend', () => {
  const text = () => {}
  text.literal = true
  const { graph, legend } = connected(
    '(text words remain literal)', { text })

  assert.deepEqual(legend.get(graph[0]), {
    name: 'text',
    capability: text,
    arguments: 'literal'
  })
  assert.equal(legend.get(graph[1][0]).name, 'words')
  assert.equal(legend.get(graph[1][1][0]).name, 'remain')
})

test('does not share literal arguments with visible identities', () => {
  const text = () => {}
  text.literal = true
  const { graph } = connected('((word x x) (text word x))', { text })
  const visible = graph[0]
  const literal = graph[1][1]

  assert.notEqual(literal[0], visible)
  assert.notEqual(literal[1], visible[0])
})

test('lets repeated names identify separate application values', () => {
  const button = () => {}
  const { graph, legend } = connected(`
    ((app x (button (event (app x)) (event (app A))))
     (app B))
  `, { button })
  const app = graph[0]
  const [stay, reset] = app[1][1]

  assert.equal(stay[0], app)
  assert.equal(reset[0], app)
  assert.equal(legend.get(stay).name, 'event')
  assert.equal(legend.get(reset).name, 'event')
  assert.notEqual(stay, reset)
})
