import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { observe } from '../../repl/observe.js'
import { bind } from './bind.js'
import { load, submit, undo } from './source.js'

const source = readFileSync(
  new URL('./seed.lisp', import.meta.url),
  'utf8'
)

test('constructs the first atom through an ordinary binding', () => {
  const state = submit(undefined, '(I (I I))')
  const I = state.identities.get('I')

  assert.equal(state.root, I)
  assert.equal(I[0], I)
  assert.equal(I[1], I)
  assert.ok(Object.isFrozen(I))
})

test('makes every new identity an authored choice', () => {
  const seed = submit(undefined, '(I (I I))')
  const repeated = submit(seed, '(A (I I))')
  const atom = submit(repeated, '(B (B B))')
  const I = atom.identities.get('I')
  const A = atom.identities.get('A')
  const B = atom.identities.get('B')

  assert.notEqual(A, I)
  assert.equal(A[0], I)
  assert.equal(A[1], I)
  assert.equal(B[0], B)
  assert.equal(B[1], B)
})

test('connects a new pair only to named identities', () => {
  const seed = submit(undefined, '(I (I I))')
  const atom = submit(seed, '(A (A A))')
  const state = submit(atom, '(B (I A))')

  assert.equal(state.root[0], state.identities.get('I'))
  assert.equal(state.root[1], state.identities.get('A'))
})

test('preserves earlier states and adds no history wrapper', () => {
  const seed = submit(undefined, '(I (I I))')
  const state = submit(seed, '(A (A A))')

  assert.equal(state.previous, seed)
  assert.equal(seed.root, seed.identities.get('I'))
  assert.equal(state.root, state.identities.get('A'))
  assert.equal(state.root[0], state.root)
  assert.equal(state.root[1], state.root)
})

test('loads sequential bindings from source', () => {
  const state = load(source)
  const I = state.identities.get('I')
  const A = state.identities.get('A')
  const B = state.identities.get('B')
  const Root = state.identities.get('Root')

  assert.equal(I[0], I)
  assert.equal(A[0], I)
  assert.equal(A[1], I)
  assert.equal(B[0], A)
  assert.equal(B[1], I)
  assert.equal(Root[0], I)
  assert.equal(Root[1], B)
  assert.equal(state.root, Root)
  assert.equal(undo(state).root, B)
})

test('bound graphs use the ordinary recursive observer', () => {
  const state = load(`
    ((I (I I))
     (B (I I))
     (A (I B))
     (Root (I A)))
  `)
  const observation = observe(state.root)

  assert.deepEqual(observation.steps, [
    state.identities.get('Root'),
    state.identities.get('A'),
    state.identities.get('B'),
    state.identities.get('I')
  ])
  assert.equal(observation.focus, state.identities.get('I'))
})

test('rejects malformed bindings', () => {
  assert.throws(() => bind(undefined, []),
                /Expected \(name \(left right\)\)/)
  assert.throws(() => submit(undefined, '(I I I)'),
                /Expected \(name \(left right\)\)/)
  assert.throws(() => submit(undefined, '(I (I))'),
                /Expected \(name \(left right\)\)/)
  assert.throws(() => submit(undefined, '(I (I (A A)))'),
                /Expected \(name \(left right\)\)/)
})

test('rejects unknown and reused names without changing prior state', () => {
  const seed = submit(undefined, '(I (I I))')

  assert.throws(() => submit(seed, '(A (I missing))'),
                /Unknown identity: missing/)
  assert.throws(() => submit(seed, '(I (I I))'),
                /Identity already exists: I/)
  assert.throws(() => submit(seed, '(A (I B))'),
                /Unknown identity: B/)
  assert.equal(seed.identities.size, 1)
  assert.equal(seed.root[0], seed.root)
  assert.equal(seed.root[1], seed.root)
})
