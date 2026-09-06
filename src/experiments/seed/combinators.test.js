import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { advance, begin, focus, pending, run } from './reduce.js'
import { load } from './source.js'

const source = readFileSync(
  new URL('./combinators.lisp', import.meta.url),
  'utf8'
)

const execute = (identities, name) => run(
  begin(identities.get(name), identities.get('Origin')),
  identities.get('Origin')
).state

test('applies a curried definition through its captured environment', () => {
  const { identities } = load(source)

  assert.equal(focus(execute(identities, 'K-a-b')), identities.get('a'))
})

test('composes graph-authored S and K as identity', () => {
  const { identities } = load(source)

  assert.equal(focus(execute(identities, 'S-K-K-a')),
               identities.get('a'))
})

test('recurs through self-application without tying identities', () => {
  const { identities } = load(source)
  let state = begin(
    identities.get('Omega'), identities.get('Origin'))
  const visited = new Set()

  for (let i = 0; i < 20; i++) {
    assert.ok(pending(state))
    visited.add(focus(state))
    state = advance(state)
  }

  assert.ok(visited.has(identities.get('O')))
  assert.ok(visited.has(identities.get('O-body')))
})
