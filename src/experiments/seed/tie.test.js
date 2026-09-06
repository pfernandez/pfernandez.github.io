import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse } from '../../graph/index.js'
import { observe } from '../../repl/observe.js'
import { submit } from './source.js'
import { tie } from './tie.js'

test('treats binding as a one-equation knot', () => {
  const bound = submit(undefined, '(I (I I))')
  const tied = tie(undefined, parse('(I (I I))'))
  const boundI = bound.identities.get('I')
  const tiedI = tied.identities.get('I')

  assert.equal(boundI[0], boundI)
  assert.equal(boundI[1], boundI)
  assert.equal(tiedI[0], tiedI)
  assert.equal(tiedI[1], tiedI)
  assert.equal(bound.identities.size, tied.identities.size)
})

test('ties a period-two orbit after the seed exists', () => {
  const seed = tie(undefined, parse('(I (I I))'))
  const state = tie(seed, parse(`
    ((A (I B))
     (B (I A)))
  `))
  const A = state.identities.get('A')
  const B = state.identities.get('B')

  assert.equal(A[1], B)
  assert.equal(B[1], A)
  assert.equal(state.root, B)
  assert.ok(Object.isFrozen(A))
  assert.ok(Object.isFrozen(B))
  assert.deepEqual(observe(B), { focus: B, steps: [B, A, B] })
})

test('ties distinguishable left and right branches', () => {
  const state = tie(undefined, parse(`
    ((left (left left))
     (right (right right))
     (root (left right)))
  `))
  const left = state.identities.get('left')
  const right = state.identities.get('right')

  assert.equal(state.root[0], left)
  assert.equal(state.root[1], right)
  assert.notEqual(state.root[0], state.root[1])
})

test('finds path-order dependence with two identities', () => {
  const one = tie(undefined, parse('(I (I I))')).root
  const two = tie(undefined, parse(`
    ((B (A A))
     (A (B A)))
  `)).root
  const leftAfterRight = graph => graph[1][0]
  const rightAfterLeft = graph => graph[0][1]

  assert.equal(leftAfterRight(one), rightAfterLeft(one))
  assert.notEqual(leftAfterRight(two), rightAfterLeft(two))
})

test('keeps knots outside the sequential binder', () => {
  const seed = submit(undefined, '(I (I I))')
  const source = '((A (I B)) (B (I A)))'

  assert.throws(() => submit(seed, source),
                /Expected \(name \(left right\)\)/)
  assert.equal(seed.identities.size, 1)
})

test('publishes nothing when a knot cannot close', () => {
  const seed = submit(undefined, '(I (I I))')

  assert.throws(() => tie(seed, parse(`
    ((A (I B))
     (B (I missing)))
  `)), /Unknown identity: missing/)
  assert.throws(() => tie(seed, parse(`
    ((A (I I))
     (A (I I)))
  `)), /Identity already exists: A/)
  assert.equal(seed.identities.size, 1)
  assert.equal(seed.root[0], seed.root)
  assert.equal(seed.root[1], seed.root)
})
