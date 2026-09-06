import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from './apply.js'
import { load } from './source.js'

test('applies identity by returning the argument identity', () => {
  const state = load(`
    ((x (x x))
     (I (x x))
     (a (a a))
     (b (b b)))
  `)
  const { identities } = state

  assert.equal(apply(identities.get('I'), identities.get('a')),
               identities.get('a'))
  assert.equal(apply(identities.get('I'), identities.get('b')),
               identities.get('b'))
})

test('applies K by selecting an identity from structured arguments', () => {
  const state = load(`
    ((Kx (Kx Kx))
     (Ky (Ky Ky))
     (Kinput (Kx Ky))
     (K (Kinput Kx))
     (a (a a))
     (b (b b))
     (arguments (a b)))
  `)
  const { identities } = state

  assert.equal(apply(identities.get('K'), identities.get('arguments')),
               identities.get('a'))
})

test('applies S by constructing only its result pairs', () => {
  const state = load(`
    ((Sx (Sx Sx))
     (Sy (Sy Sy))
     (Sz (Sz Sz))
     (Syz (Sy Sz))
     (Sinput (Sx Syz))
     (Sxz (Sx Sz))
     (Syz-body (Sy Sz))
     (Sbody (Sxz Syz-body))
     (S (Sinput Sbody))
     (a (a a))
     (b (b b))
     (c (c c))
     (bc (b c))
     (arguments (a bc)))
  `)
  const { identities } = state
  const constructed = []
  const construct = (left, right) => {
    const graph = Object.freeze([left, right])
    constructed.push(graph)
    return graph
  }
  const result = apply(
    identities.get('S'), identities.get('arguments'), construct)

  assert.equal(constructed.length, 3)
  assert.equal(result[0][0], identities.get('a'))
  assert.equal(result[0][1], identities.get('c'))
  assert.equal(result[1][0], identities.get('b'))
  assert.equal(result[1][1], identities.get('c'))
  assert.ok(constructed.every(Object.isFrozen))
})

test('constructs a shared body identity only once', () => {
  const parameter = []
  parameter[0] = parameter[1] = parameter
  Object.freeze(parameter)
  const argument = []
  argument[0] = argument[1] = argument
  Object.freeze(argument)
  const shared = [parameter, parameter]
  const transition = [parameter, [shared, shared]]
  let constructions = 0
  const construct = (left, right) => {
    constructions++
    return Object.freeze([left, right])
  }
  const result = apply(transition, argument, construct)

  assert.equal(result[0], result[1])
  assert.equal(constructions, 2)
})

test('requires repeated inputs to receive the same identity', () => {
  const state = load(`
    ((x (x x))
     (xx (x x))
     (same (xx x))
     (a (a a))
     (b (b b))
     (aa (a a))
     (ab (a b)))
  `)
  const { identities } = state

  assert.equal(apply(identities.get('same'), identities.get('aa')),
               identities.get('a'))
  assert.throws(
    () => apply(identities.get('same'), identities.get('ab')),
    /Argument does not match transition input/
  )
})

test('leaves recursive result construction for the tie experiment', () => {
  const parameter = []
  parameter[0] = parameter[1] = parameter
  Object.freeze(parameter)
  const body = []
  body[0] = parameter
  body[1] = body
  const transition = [parameter, body]

  assert.throws(() => apply(transition, parameter),
                /Recursive results require a tie/)
})
