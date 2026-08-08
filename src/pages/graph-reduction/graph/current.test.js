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

  const ix = find(I, 'x')
  assert.equal(I[0], I)
  assert.equal(I[1], ix)
  assert.equal(I[2], ix)

  const ky = find(K[1], 'y')
  assert.equal(K[0], K)
  assert.equal(K[2][0], I)
  assert.equal(K[2][1], ky)

  const sx = find(S[1], 'x')
  const sy = find(S[1], 'y')
  const sz = find(S[1], 'z')
  assert.equal(S[0], S)
  assert.equal(S[2][0][0], sx)
  assert.equal(S[2][0][1], sz)
  assert.equal(S[2][1][0], sy)
  assert.equal(S[2][1][1], sz)

  const yf = find(Y, 'f')
  assert.equal(Y[0], Y)
  assert.equal(Y[2][0], yf)
  assert.equal(Y[2][1][0], Y)
  assert.equal(Y[2][1][1], yf)
})
