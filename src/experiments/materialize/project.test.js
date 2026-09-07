import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  atom,
  materialize,
  next,
  pair,
  retain
} from './materialize.js'
import { project } from './project.js'

test('passes one raw graph identity through the device boundary', () => {
  const capability = atom()
  const left = atom()
  const right = atom()
  const argument = pair(left, right)
  const call = pair(capability, argument)
  const focus = materialize(retain(call))
  const legend = new Map([[capability, {
    capability: value => value
  }]])

  assert.equal(project(focus, legend), argument)
  assert.equal(next(focus), focus)
})

test('does not search or advance when no capability is observed', () => {
  const focus = materialize(retain(pair(atom(), atom())))

  assert.throws(
    () => project(focus, new Map()),
    /Observation is not a capability call/
  )
})
