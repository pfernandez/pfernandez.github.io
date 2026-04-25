import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, construct, encode, parse, serialize } from './index.js'

const hasGraph = value =>
  value && typeof value === 'object' && Object.hasOwn(value, 'graph')

const graphOf = value => hasGraph(value) ? value.graph : value
const sequenceOf = value => hasGraph(value) ? value.sequence : []
const witnessOf = value => hasGraph(value) ? value.witness ?? [] : []

const serializeState = value =>
  serialize(graphOf(value), sequenceOf(value), witnessOf(value))

describe('graph coverage boundaries', () => {
  test('construct ignores sparse template candidates and keeps ordinary shape', () => {
    assert.equal(serializeState(construct([[[0, 2], 'a'], 'b'])),
                 '(((0 2) a) b)')
  })

  test('construct prefers the outermost complete template when arities tie', () => {
    assert.equal(serializeState(construct([[[[0, 1], 'a'], 'b'], 'c'])),
                 '(((((0 1) c) a) b))')
  })

  test('partial non-template calls materialize as finite source calls', () => {
    assert.equal(serializeState(compile(`
      (defn F (x y) (helper x y))
      (F a)
    `)), '(F a)')
  })

  test('encode compacts sparse projected slots from live graph projection', () => {
    assert.deepEqual(encode(parse(`
      (defn right (x y) y)
      ((right a) b)
    `)), [0, 'b'])
  })

  test('serialize projects a repeated cycle payload without recursing forever', () => {
    const cycle = ['x', null]
    cycle[1] = cycle
    const fixed = []
    fixed[0] = fixed
    fixed[1] = cycle

    assert.equal(serialize(['atom', fixed], [fixed]), '(atom 0)')
  })
})
