import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { link } from './index.js'

const source = readFileSync(new URL('../core.lisp', import.meta.url), 'utf8')

const find = (scope, symbol) =>
  scope.find(node => node['symbol'] === symbol)

test('links the current combinator identities', () => {
  const { graph, error } = link(source)
  if (error) throw error

  const I = find(graph, 'I')
  const K = find(graph, 'K')
  const S = find(graph, 'S')
  const Y = find(graph, 'Y')
  const call = graph.at(-1)

  const ix = find(I, 'x')
  assert.equal(I[0], I)
  assert.equal(I[1], ix)
  assert.equal(I[2], ix)

  const ky = find(K[1], 'y')
  assert.equal(K[0], K)
  assert.equal(K[2][0], ky)
  assert.equal(K[2][1], ky)
  assert.equal(K[2].length, 2)

  const sx = find(S[1], 'x')
  const sy = find(S[1], 'y')
  const sz = find(S[1], 'z')
  assert.equal(S[0], S)
  assert.equal(S[2][0][0], sx)
  assert.equal(S[2][0][1], sz)
  assert.equal(S[2][1][0], sy)
  assert.equal(S[2][1][1], sz)
  assert.equal(S[2][0].length, 2)
  assert.equal(S[2][1].length, 2)

  const [args, result] = call
  assert.equal(call.length, 2)
  assert.equal(call.includes(S), false)
  assert.equal(call['symbol'], undefined)
  assert.notEqual(result, S[2])
  assert.equal(result[0][0], args[0])
  assert.equal(result[0][1], args[2])
  assert.equal(result[1][0], args[1])
  assert.equal(result[1][1], args[2])
  assert.equal(result[0].length, 2)
  assert.equal(result[1].length, 2)

  const yf = find(Y, 'f')
  assert.equal(Y[0], Y)
  assert.equal(Y[2][0], yf)
  assert.equal(Y[2][1][0], Y)
  assert.equal(Y[2][1][1], yf)
  assert.equal(Y[2][1].length, 2)

  assert.equal(Object.isFrozen(graph), true)
  assert.equal(Object.isFrozen(S), true)
  assert.equal(Object.isFrozen(sx), true)
  assert.equal(Object.isFrozen(result), true)
})

test('shadows an outer parameter in a nested definition', () => {
  const { graph, error } = link(source)
  if (error) throw error

  const F = find(graph, 'F')
  const outer = F[1]
  const sequence = F[2]
  const G = sequence[0]
  const inner = G[1]

  assert.notEqual(inner, outer)
  assert.equal(G[2], inner)
  assert.equal(sequence[1], outer)
})

test('captures an outer parameter in a nested definition', () => {
  const { graph, error } = link('((F (x) (G (y) x)))')
  if (error) throw error

  const F = graph[0]
  const G = F[2]

  assert.notEqual(G[1], F[1])
  assert.equal(G[2], F[1])
})

test('preserves an authored result', () => {
  const { graph, error } = link('((I x x) (I a b))')
  if (error) throw error

  const [I, call] = graph
  assert.equal(graph.length, 2)
  assert.equal(call[0], I)
  assert.equal(call[1]['symbol'], 'a')
  assert.equal(call[2]['symbol'], 'b')
})
