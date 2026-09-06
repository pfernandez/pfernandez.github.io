import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { load } from './source.js'

const source = readFileSync(
  new URL('./transitions.lisp', import.meta.url),
  'utf8'
)

test('authors concrete applications as before and after identities', () => {
  const { identities } = load(source)

  assert.deepEqual(identities.get('I-event'), [
    identities.get('I-call'),
    identities.get('a')
  ])
  assert.deepEqual(identities.get('K-event'), [
    identities.get('K-call'),
    identities.get('a')
  ])
  assert.deepEqual(identities.get('S-event'), [
    identities.get('S-call'),
    identities.get('Sresult')
  ])
})

test('retains concrete transitions in an authored history', () => {
  const state = load(source)
  const { identities } = state
  const root = identities.get('Root')

  assert.equal(root[0][0][0], identities.get('History'))
  assert.equal(root[0][0][1], identities.get('I-event'))
  assert.equal(root[0][1], identities.get('K-event'))
  assert.equal(root[1], identities.get('S-event'))
  assert.equal(state.root, root)
})
