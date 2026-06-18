import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  observe,
  select,
  serialize
} from './index.js'

describe('compiler wiring', () => {
  test('I wires its argument to its body', () => {
    const graph = compile('(((I x) x) (I a))')
    const found = observe(graph)

    assert.equal(serialize(graph), '(($.0 a) a)')
    assert.equal(serialize(found), '($ a)')
    assert.equal(serialize(select(found)), 'a')
  })
})
