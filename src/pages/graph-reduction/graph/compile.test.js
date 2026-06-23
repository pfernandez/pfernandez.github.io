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
    const { graph, legend } = compile('(((I x) x) (I a))')
    const found = observe(graph)

    assert.equal(serialize(graph, legend), '(($.0 a) a)')
    assert.equal(serialize(found, legend), '($ a)')
    assert.equal(serialize(select(found), legend), 'a')
    assert.deepEqual(legend.map(([, spelling]) => spelling), ['a'])
  })
})
