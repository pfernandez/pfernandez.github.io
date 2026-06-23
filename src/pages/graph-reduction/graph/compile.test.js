import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  observe,
  select,
  serialize
} from './index.js'

describe('compiler wiring', () => {
  test('replaces symbols with identities', () => {
    const { graph, legend } = compile('(((I x) x) (I a))')
    const [definition, focus] = graph
    const [signature, body] = definition
    const [defined, parameter] = signature
    const [called, argument] = focus

    assert.equal(serialize(graph, { legend }), '(((I x) x) (I a))')
    assert.equal(body, parameter)
    assert.equal(called, defined)
    assert.notEqual(argument, parameter)
    assert.deepEqual(legend.map(([, name]) => name), ['I', 'x', 'a'])
  })

  test('observes the active call', () => {
    const { graph, legend } = compile('(((I x) x) (I a))')
    const found = observe(graph)

    assert.equal(serialize(found, { legend }), '(I x)')
    assert.equal(serialize(select(found), { legend }), 'x')
  })

  test('returns an error when source does not compile', () => {
    const { graph, legend, error } = compile('(')

    assert.deepEqual(graph, [])
    assert.deepEqual(legend, [])
    assert.match(error.message, /Missing \)/)
  })
})
