import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link } from './index.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

test('shares S identities between its parameters, body, and use', () => {
  const { graph } = linked(`
  ((S (x y z) ((x z) (y z)))
   (S (a b c) ((a c) (b c))))
  `)

  const [definition, focus] = graph
  const [, parameters, body] = definition
  const [call] = focus

  assert.equal(call, definition)
  assert.equal(body[0][0], parameters[0])
  assert.equal(body[0][1], parameters[2])
  assert.equal(body[1][0], parameters[1])
  assert.equal(body[1][1], parameters[2])

  const c = focus[1][2]
  assert.equal(c[0], c)
  assert.equal(c[1], c)
})

test('shares Y identities with its recursive body', () => {
  const { graph } = linked(`
  ((Y f (f (Y f)))
   (Y a))
  `)

  const definition = graph[0]
  const [, f, body] = definition

  assert.equal(definition[0], definition)
  assert.equal(body[0], f)
  assert.equal(body[1][0], definition)
  assert.equal(body[1][1], f)
})

test('does not resolve a symbol to a later definition', () => {
  const { graph } = linked(`
  ((F x G)
   (G y y))
  `)

  const [F, G] = graph

  assert.equal(F[2]['symbol'], 'G')
  assert.equal(F[2][0], F[2])
  assert.equal(F[2][1], F[2])
  assert.notEqual(F[2], G)
})

test('does not expose a sibling definition\'s parameters', () => {
  const { graph } = linked(`
  ((F x
      ((G (y) y)
       (H z y))))
  `)

  const F = graph[0]
  const [G, H] = F[2]

  assert.equal(H[2]['symbol'], 'y')
  assert.equal(H[2][0], H[2])
  assert.equal(H[2][1], H[2])
  assert.notEqual(H[2], G[1])
})

test('introduces a bare parameter before resolving an outer identity', () => {
  const { graph } = linked(`
  ((F x
      ((G x x)
       x)))
  `)

  const F = graph[0]
  const outer = F[1]
  const [G, following] = F[2]

  assert.notEqual(G[1], outer)
  assert.equal(G[2], G[1])
  assert.equal(following, outer)
})

test('does not treat a parameter identity as a definition', () => {
  const { graph } = linked('((F (x y z) (x z)))')
  const F = graph[0]
  const parameters = F[1]
  const body = F[2]

  assert.equal(body[0], parameters)
  assert.equal(body[1], parameters[2])
})
