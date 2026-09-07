import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  apply,
  atom,
  materialize,
  next,
  observe,
  pair,
  retain,
  sequence,
  value
} from './materialize.js'

const observations = root => {
  const visited = []
  observe(root, graph => visited.push(graph))
  return visited
}

test('materializes identity as a static recurrent transition', () => {
  const a = atom()
  const identity = argument => value(argument)
  const root = materialize(apply(identity, value(a)))
  const [application] = observations(root)

  assert.equal(application[0], a)
  assert.equal(application[1], a)
  assert.equal(root[1], root)
  assert.equal(next(root), root)
  assert.equal(Object.isFrozen(root), true)
})

test('passes a pair-valued result by its exact identity', () => {
  const a = atom()
  const b = atom()
  const c = atom()
  const tag = atom()
  const args = pair(a, pair(b, c))
  const S = () => value(pair(pair(a, c), pair(b, c)))
  const consume = result => value(pair(tag, result))

  const produced = apply(S, value(args))
  const consumed = apply(consume, produced)
  const [first, second] = observations(materialize(consumed))
  const result = first[1]

  assert.equal(second[0], result)
  assert.equal(second[1][1], result)
  assert.equal(result[0][1], c)
  assert.equal(result[1][1], c)
})

test('retains private construction before exposing its value', () => {
  const a = atom()
  const parameter = atom()
  const local = pair(parameter, parameter)
  const identity = argument => value(argument)
  const outer = argument => sequence(
    retain(local),
    apply(identity, value(argument))
  )

  const produced = apply(outer, value(a))
  const consume = result => value(pair(result, result))
  const history = observations(materialize(apply(consume, produced)))

  assert.equal(history[0], local)
  assert.equal(history[1][0], a)
  assert.equal(history[1][1], a)
  assert.equal(history[2][1], a)
  assert.equal(history[3][0], a)
  assert.equal(history[3][1][0], a)
  assert.equal(history[3][1][1], a)
})

test('the observer follows frames without entering observed pairs', () => {
  const left = atom()
  const right = atom()
  const data = pair(left, right)
  const following = pair(right, left)
  const root = materialize(sequence(retain(data), retain(following)))

  assert.deepEqual(observations(root), [data, following])
  assert.equal(root[1][1], root[1])
})
