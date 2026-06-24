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
    const { graph, focus, legend } =
      compile('(((I x) x) (() (I a)))')
    const [definition, rooted] = graph
    const [signature, body] = definition
    const [defined, parameter] = signature
    const [root, call] = rooted
    const [called, argument] = call

    assert.equal(
      serialize(graph, { legend }),
      '(((I x) x) (() (I a)))')
    assert.equal(focus, call)
    assert.equal(root[0], root)
    assert.equal(root[1], root)
    assert.equal(body, parameter)
    assert.equal(called, defined)
    assert.notEqual(argument, parameter)
    assert.deepEqual(
      legend.map(([, name]) => name),
      ['I', 'x', '()', 'a'])
  })

  test('observes from the root identity', () => {
    const { focus, legend } = compile('(((I x) x) (() (I a)))')
    const result = select(observe(focus))

    assert.equal(serialize(focus, { legend }), '(I a)')
    assert.equal(serialize(result, { legend }), 'a')
  })

  test('returns an error when source does not compile', () => {
    const { graph, focus, legend, error } = compile('(')

    assert.deepEqual(graph, [])
    assert.equal(focus, undefined)
    assert.deepEqual(legend, [])
    assert.match(error.message, /Missing \)/)
  })
})
