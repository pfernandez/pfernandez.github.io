import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  begin,
  focus,
  identify,
  pending,
  resolve,
  run,
  select
} from './machine.js'
import { load } from './source.js'

const source = readFileSync(
  new URL('./transitions.lisp', import.meta.url),
  'utf8'
)

const events = history => {
  const result = []
  let current = history

  while (current[0] !== current) {
    result.unshift(current[1])
    current = current[0]
  }
  return result
}

const enter = (identities, name, argument) => run(
  begin(
    identities.get(name),
    identities.get(argument),
    identities.get('History')
  ),
  identify,
  identities.get('History')
)

test('exposes each input match as a state transition', () => {
  const { identities } = load(source)
  const I = enter(identities, 'I', 'a')
  const K = enter(identities, 'K', 'Kargs')
  const S = enter(identities, 'S', 'Sargs')

  assert.equal(events(I.history).length, 1)
  assert.equal(events(K.history).length, 3)
  assert.equal(events(S.history).length, 5)
  assert.equal(focus(I.state), identities.get('Ix'))
  assert.equal(focus(K.state), identities.get('Kx'))
  assert.equal(focus(S.state), identities.get('Sbody'))
  assert.ok(!pending(S.state))
})

test('resolves one carried binding at a time', () => {
  const { identities } = load(source)
  const entered = enter(identities, 'S', 'Sargs').state
  const left = select(entered, 0)
  const parameter = select(left, 0)
  const observed = run(
    parameter,
    resolve,
    identities.get('History')
  )

  assert.equal(events(observed.history).length, 3)
  assert.equal(focus(observed.state), identities.get('a'))
})

test('retains its environment while moving through the body', () => {
  const { identities } = load(source)
  const entered = enter(identities, 'S', 'Sargs').state
  const left = select(entered, 0)
  const right = select(entered, 1)

  assert.equal(left[0], entered[0])
  assert.equal(right[0], entered[0])
  assert.equal(focus(left), identities.get('Sxz'))
  assert.equal(focus(right), identities.get('Syz-body'))
})

test('records immutable before and after frames', () => {
  const { identities } = load(source)
  const entered = enter(identities, 'K', 'Kargs')

  events(entered.history).forEach(event => {
    assert.ok(Object.isFrozen(event))
    assert.ok(Object.isFrozen(event[0]))
    assert.ok(Object.isFrozen(event[1]))
    assert.notEqual(event[0], event[1])
  })
})
