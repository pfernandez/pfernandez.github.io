import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  observe,
  serialize
} from './index.js'

describe('compiler wiring', () => {
  test('wires identities defined by pairs', () => {
    const source = `
      ((a (a a))
       ((x a)
        ((I (I x))
         (I x))))
    `
    const { graph, legend } = compile(source)
    const [I, a] = graph

    assert.equal(serialize(graph, { legend }), '(I a)')
    assert.equal(I[0], I)
    assert.equal(I[1], a)
    assert.equal(observe(graph), a)
    assert.deepEqual(legend.map(([, name]) => name), ['a', 'x', 'I'])
  })

  test('returns an error when source does not compile', () => {
    const { graph, legend, error } = compile('(')

    assert.deepEqual(graph, [])
    assert.deepEqual(legend, [])
    assert.match(error.message, /Missing \)/)
  })
})
