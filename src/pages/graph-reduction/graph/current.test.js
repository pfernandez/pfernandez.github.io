import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { link, step } from './index.js'

const source = readFileSync(new URL('../core.lisp', import.meta.url), 'utf8')

const forms = (graph, length) =>
  length === 1 ? [graph] : [graph[0], ...forms(graph[1], length - 1)]

test('links the current combinator identities', () => {
  const { graph, focus, error } = link(source)
  if (error) throw error

  const [I, K, S, , Y, application] = forms(graph, 6)

  assert.equal(focus, application)

  const ix = I[0]
  assert.equal(I['symbol'], 'I')
  assert.equal(I[1], ix)
  assert.equal(ix[0], ix)
  assert.equal(ix[1], ix)

  const ky = K[0][0]
  assert.equal(K['symbol'], 'K')
  assert.equal(K[1][0], ky)
  assert.equal(K[1][1], ky)

  const parameters = S[0]
  const sx = parameters[0]
  const sy = parameters[1][0]
  const sz = parameters[1][1]
  const body = S[1]
  assert.equal(S['symbol'], 'S')
  assert.equal(body[0][0], sx)
  assert.equal(body[0][1], sz)
  assert.equal(body[1][0], sy)
  assert.equal(body[1][1], sz)

  const [args, result] = application
  assert.equal(application.length, 2)
  assert.equal(application.includes(S), false)
  assert.equal(application['symbol'], undefined)
  assert.notEqual(result, body)
  assert.equal(result[0][0], args[0])
  assert.equal(result[0][1], args[1][1])
  assert.equal(result[1][0], args[1][0])
  assert.equal(result[1][1], args[1][1])
  assert.equal(step(application), result)

  const yf = Y[0]
  const ybody = Y[1]
  assert.equal(Y['symbol'], 'Y')
  assert.equal(ybody[0], yf)
  assert.equal(ybody[1][0], Y)
  assert.equal(ybody[1][1], yf)

  assert.equal(Object.isFrozen(graph), true)
  assert.equal(Object.isFrozen(S), true)
  assert.equal(Object.isFrozen(sx), true)
  assert.equal(Object.isFrozen(result), true)
})

test('shadows an outer parameter in a nested definition', () => {
  const { graph, error } = link(source)
  if (error) throw error

  const [, , , F] = forms(graph, 6)
  const outer = F[0]
  const sequence = F[1]
  const G = sequence[0]
  const inner = G[0]

  assert.notEqual(inner, outer)
  assert.equal(inner[1], inner)
  assert.equal(sequence[1], outer)
})

test('captures an outer parameter in a nested definition', () => {
  const { graph, error } = link('((F (x) (G (y) x)))')
  if (error) throw error

  const F = graph
  const G = F[1]

  assert.notEqual(G[0], F[0])
  assert.equal(G[1], F[0])
})

test('preserves an authored result', () => {
  const { graph, focus, error } = link('((I x x) ((I a) b))')
  if (error) throw error

  const application = focus[0]
  assert.equal(application[1], application[0])
  assert.equal(application[0]['symbol'], 'a')
  assert.equal(focus[1]['symbol'], 'b')
})
