import assert from 'node:assert/strict'
import { test } from 'node:test'
import { connect } from './connect.js'
import { decompose } from './decompose.js'
import { parse } from './parse.js'

const connected = (source, imports) =>
  connect(decompose(parse(source)), imports)

test('connects lexical identities without applying them', () => {
  const { definitions, graph } = connected(`
    ((I x x)
     (I a))
  `)
  const [I, application] = graph

  assert.equal(definitions.get(I).input, I[0])
  assert.equal(I[0], I[1])
  assert.equal(application[0], I)
  assert.equal(application[1]['symbol'], 'a')
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
  const { capabilities, graph, legend } = connected(
    '(text words remain literal)', { text })

  assert.equal(capabilities.get(graph[0]), text)
  assert.deepEqual(legend.get(graph[0]), {
    name: 'text',
    capability: text,
    arguments: 'literal'
  })
  assert.equal(graph[1][0]['symbol'], 'words')
  assert.equal(graph[1][1][0]['symbol'], 'remain')
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
