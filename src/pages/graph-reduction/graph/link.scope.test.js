import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link } from './index.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

test('shares S identities between its signature, body, and call', () => {
  const { graph } = linked(`
  (((S x y z) ((x z) (y z)))
   ((S a b c) ((a c) (b c))))
  `)

  const [definition, focus] = graph
  const [signature, body] = definition
  const [call] = focus

  assert.equal(signature[0], definition)
  assert.equal(body[0][0], signature[1])
  assert.equal(body[0][1], signature[3])
  assert.equal(body[1][0], signature[2])
  assert.equal(body[1][1], signature[3])
  assert.equal(call[0], definition)

  const c = call[3]
  assert.equal(c[0], c)
  assert.equal(c[1], c)
})

test('shares Y identities with its recursive body', () => {
  const { graph } = linked(`
  (((Y f) (f (Y f)))
   (Y a))
  `)

  const definition = graph[0]
  const [signature, body] = definition

  assert.equal(signature[0], definition)
  assert.equal(body[0], signature[1])
  assert.equal(body[1][0], definition)
  assert.equal(body[1][1], signature[1])
})
