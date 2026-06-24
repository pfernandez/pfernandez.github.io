import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  observe,
  serialize
} from './index.js'

describe('compiler wiring', () => {
  test('wires arguments into the definition body', () => {
    const { graph, legend } = compile('(((I x) x) (I a))')
    const [call, argument] = graph
    const result = call[1]

    assert.equal(serialize(graph, { legend }), '(($.0 a) a)')
    assert.equal(call[0], call)
    assert.equal(result, argument)
    assert.equal(observe(graph), argument)
    assert.deepEqual(legend.map(([, name]) => name), ['a'])
  })

  test('returns an error when source does not compile', () => {
    const { graph, legend, error } = compile('(')

    assert.deepEqual(graph, [])
    assert.deepEqual(legend, [])
    assert.match(error.message, /Missing \)/)
  })
})
