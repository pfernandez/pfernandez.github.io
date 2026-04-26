import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, construct, encode, parse, serialize } from './index.js'
import { materialize } from './materialize.js'

const hasGraph = value =>
  value && typeof value === 'object' && Object.hasOwn(value, 'graph')

const graphOf = value => hasGraph(value) ? value.graph : value
const sequenceOf = value => hasGraph(value) ? value.sequence : []
const witnessOf = value => hasGraph(value) ? value.witness ?? [] : []

const serializeState = value =>
  serialize(graphOf(value), sequenceOf(value), witnessOf(value))

describe('graph coverage boundaries', () => {
  test('compile returns parse errors before graph construction', t => {
    const { mock } = t.mock.method(console, 'error', () => {})
    const error = compile('(')

    assert(error instanceof Error)
    assert.match(error.message, /Missing \)/)
    assert.equal(mock.calls.length, 1)
  })

  test('construct ignores sparse template candidates and keeps ordinary shape', () => {
    assert.equal(serializeState(construct([[[0, 2], 'a'], 'b'])),
                 '(((0 a) b) 2)')
  })

  test('construct keeps ordinary shape when complete templates tie', () => {
    assert.equal(serializeState(construct([[[[0, 1], 'a'], 'b'], 'c'])),
                 '((((0 1) a) b) c)')
  })

  test('partial non-template calls materialize as finite source calls', () => {
    assert.equal(serializeState(compile(`
      (defn F (x y) (helper x y))
      (F a)
    `)), '(F a)')
  })

  test('materialize remembers repeated non-fixed graph points as witnesses', () => {
    const shared = ['a', 'b']
    const state = materialize([shared, shared])

    assert.equal(state.graph[0], state.graph[1])
    assert.deepEqual(state.witness, [state.graph[0]])
  })

  test('encode compacts sparse projected slots from live graph projection', () => {
    assert.deepEqual(encode(parse(`
      (defn right (x y) y)
      ((right a) b)
    `)), [0, 'b'])
  })

  test('serialize projects nested hidden witness payloads', () => {
    const inner = ['inner', 'payload']
    const outer = ['outer', inner]

    assert.equal(serialize(['atom', outer], [], [outer, inner]),
                 '(atom payload)')
  })

  test('serialize projects a repeated cycle payload without recursing forever', () => {
    const cycle = ['x', null]
    cycle[1] = cycle
    const fixed = []
    fixed[0] = fixed
    fixed[1] = cycle

    assert.equal(serialize(['atom', fixed], [fixed]), '(atom (x (x 0)))')
  })

  test('serialize projects self-payload fixed points by traversal label', () => {
    const fixed = []
    fixed[0] = fixed
    fixed[1] = fixed

    assert.equal(serialize(['atom', fixed], [fixed]), '(atom 0)')
  })
})
