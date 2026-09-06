import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  advance,
  begin,
  focus,
  isDefinition,
  pending,
  run
} from './reduce.js'
import { load } from './source.js'

const source = readFileSync(
  new URL('./combinators.lisp', import.meta.url),
  'utf8'
)

const execute = (identities, name) => run(
  begin(identities.get(name), identities.get('Origin')),
  identities.get('Origin')
)

const transitions = history => {
  const result = []
  let current = history

  while (current[0] !== current) {
    result.unshift(current[1])
    current = current[0]
  }
  return result
}

test('recognizes definitions from their own left identity', () => {
  const { identities } = load(source)

  assert.ok(isDefinition(identities.get('I')))
  assert.ok(isDefinition(identities.get('K')))
  assert.ok(isDefinition(identities.get('S')))
  assert.ok(!isDefinition(identities.get('a')))
  assert.ok(!isDefinition(identities.get('S-a-b-c')))
})

test('observes I and K without materializing their bodies', () => {
  const { identities } = load(source)

  assert.equal(focus(execute(identities, 'I-a').state),
               identities.get('a'))
  assert.equal(focus(execute(identities, 'K-a-b').state),
               identities.get('a'))
})

test('visits the authored S body before reaching its fixed observation', () => {
  const { identities } = load(source)
  const result = execute(identities, 'S-a-b-c')
  const visited = transitions(result.history).map(event => focus(event[0]))

  assert.ok(visited.includes(identities.get('S-body')))
  assert.ok(visited.includes(identities.get('Sx-z')))
  assert.equal(focus(result.state), identities.get('c'))
})

test('retains reduction as one connected sequence of transitions', () => {
  const { identities } = load(source)
  const result = execute(identities, 'S-a-b-c')
  const events = transitions(result.history)

  events.slice(1).forEach((event, index) => {
    assert.equal(events[index][1], event[0])
  })
  assert.equal(events.at(-1)[1], result.state)
})

test('applies a returned definition in its observed environment', () => {
  const { identities } = load(source)
  const first = execute(identities, 'K-a-b')
  const second = execute(identities, 'K-b-a')

  assert.equal(focus(first.state), identities.get('a'))
  assert.equal(focus(second.state), identities.get('b'))
})

test('treats an immediate anonymous definition as let', () => {
  const initial = load(source)
  const state = load(`
    ((local (local local))
     (local-spec (local local))
     (local-function (local-function local-spec))
     (let (local-function b)))
  `, initial)
  const result = execute(state.identities, 'let')

  assert.equal(focus(result.state), state.identities.get('b'))
})

test('leaves structured inputs to the separate matching experiment', () => {
  const initial = load(source)
  const state = load(`
    ((structured-input (a b))
     (structured-spec (structured-input a))
     (structured (structured structured-spec))
     (structured-argument (a b))
     (structured-call (structured structured-argument)))
  `, initial)

  assert.throws(
    () => execute(state.identities, 'structured-call'),
    /Definition input must be one identity/
  )
})

test('advances forever when an authored expression recurs', () => {
  const state = load(source)
  let current = begin(
    state.identities.get('Omega'),
    state.identities.get('Origin')
  )

  for (let i = 0; i < 12; i++) {
    assert.ok(pending(current))
    current = advance(current)
  }
  assert.ok([
    state.identities.get('O'),
    state.identities.get('O-body')
  ].includes(focus(current)))
})
