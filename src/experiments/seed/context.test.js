import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { enter, focus, select } from './context.js'
import { load } from './source.js'

const source = readFileSync(
  new URL('./transitions.lisp', import.meta.url),
  'utf8'
)

test('observes I and K through carried bindings', () => {
  const { identities } = load(source)
  const a = identities.get('a')

  assert.equal(focus(enter(identities.get('I'), a)), a)
  assert.equal(focus(enter(
    identities.get('K'), identities.get('Kargs'))), a)
})

test('observes S through its unchanged authored body', () => {
  const { identities } = load(source)
  const observation = enter(
    identities.get('S'), identities.get('Sargs'))
  const left = select(observation, 0)
  const right = select(observation, 1)

  assert.equal(observation[1], identities.get('Sbody'))
  assert.equal(focus(select(left, 0)), identities.get('a'))
  assert.equal(focus(select(left, 1)), identities.get('c'))
  assert.equal(focus(select(right, 0)), identities.get('b'))
  assert.equal(focus(select(right, 1)), identities.get('c'))
})

test('reads the same result through an authored local environment', () => {
  const { identities } = load(source)
  const observation = identities.get('S-observation')
  const left = select(observation, 0)
  const right = select(observation, 1)

  assert.equal(observation[1], identities.get('Sbody'))
  assert.equal(focus(select(left, 0)), identities.get('a'))
  assert.equal(focus(select(left, 1)), identities.get('c'))
  assert.equal(focus(select(right, 0)), identities.get('b'))
  assert.equal(focus(select(right, 1)), identities.get('c'))
})

test('gives separate arguments separate contextual observations', () => {
  const { identities } = load(source)
  const first = enter(identities.get('I'), identities.get('a'))
  const second = enter(identities.get('I'), identities.get('b'))

  assert.notEqual(first[0], second[0])
  assert.equal(first[1], second[1])
  assert.equal(focus(first), identities.get('a'))
  assert.equal(focus(second), identities.get('b'))
})
