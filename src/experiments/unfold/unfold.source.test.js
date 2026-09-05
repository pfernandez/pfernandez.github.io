import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from '../../graph/index.js'
import { assemble } from './assemble.js'
import { unfold } from './unfold.js'

const source = readFileSync(
  new URL('./unfold.lisp', import.meta.url),
  'utf8'
)

const program = () => assemble(parse(source))

test('assembles causally named pair values', () => {
  const { names } = assemble(parse(`
    ((left left)
     (right left left))
  `))
  const left = names.get('left')
  const right = names.get('right')

  assert.equal(left[0], left)
  assert.equal(left[1], left)
  assert.equal(right[0], left)
  assert.equal(right[1], left)
})

test('unfolds a source-authored root before composition', () => {
  const connected = program()
  const machine = connected.names.get('machine')
  const next = unfold(machine)

  assert.equal(next[0], machine[0])
  assert.equal(next[1][0], machine[1][0])
  assert.notEqual(next[1][1], machine[1][1])
  assert.equal(next[1][1][1], machine[1][1][1])
})

test('constructs and enters a source-authored function', () => {
  const connected = program()
  const construction = connected.names.get('construction')
  const known = connected.names.get('known')
  const entered = unfold(construction)
  const call = entered[1]
  const constructed = call[1][0]

  assert.equal(entered[0], construction[0])
  assert.notEqual(constructed, known)
  assert.equal(constructed[0], known[0])
  assert.equal(constructed[1], known[1])
  assert.equal(call[0], construction[1][0])
  assert.equal(call[1][1], connected.names.get('value'))
})

test('runs source-authored pair functions', () => {
  const connected = program()
  const { names } = connected
  const A = names.get('A')
  const B = names.get('B')
  const identity = unfold(names.get('identity-root'))
  const first = unfold(names.get('first-root'))
  const second = unfold(names.get('second-root'))
  const duplicate = unfold(names.get('duplicate-root'))
  const swap = unfold(names.get('swap-root'))

  assert.equal(identity[1][1], A)
  assert.equal(first[1][1], A)
  assert.equal(second[1][1], B)
  assert.notEqual(duplicate[1][1], A)
  assert.equal(duplicate[1][1][0], A)
  assert.equal(duplicate[1][1][1], A)
  assert.equal(swap[1][1][0], B)
  assert.equal(swap[1][1][1], A)
})
