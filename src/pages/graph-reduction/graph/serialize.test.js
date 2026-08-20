import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  schemeNames,
  schemes,
  serialize
} from './index.js'

describe('serialize', () => {
  test('text names repeated paths and cycles', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    assert.equal(serialize(root), '($ ((a b) $.1.0))')
  })

  test('presentation schemes retain repeated identity', () => {
    const root = []
    const shared = ['a', 'b']

    root[0] = root
    root[1] = [shared, shared]

    assert.deepEqual(schemeNames, Object.values(schemes))
    assert.deepEqual(
      serialize(root, { format: 'vdom', scheme: schemes.plain }).slice(0, 2),
      ['pre', { class: 'output' }])
  })

  test('replaces references with symbols in arbitrary sequences', () => {
    const x = []
    const y = []
    x[0] = x[1] = x
    y[0] = y[1] = y
    x.symbol = 'x'
    y.symbol = 'y'
    const graph = [x, [y, x], []]
    const expected = '(x (y x) ())'

    assert.equal(serialize(graph), expected)
    assert.equal(
      serialize(graph, { width: 10 }),
      '(x\n (y x)\n ())')
  })

  test('vdom format returns an elements-style array', () => {
    const root = []
    root[0] = root
    root[1] = 'a'

    assert.deepEqual(
      serialize(root, { format: 'vdom', scheme: schemes.plain }),
      [
        'pre',
        { class: 'output' },
        ['span', { class: 'identity', style: {} }, '('],
        ['span', { class: 'identity', style: {} }, '()'],
        ' ',
        'a',
        ['span', { class: 'identity', style: {} }, ')']
      ])
  })

  test('vdom colors are stable for the same cell across renders', () => {
    const root = []
    root[0] = root
    root[1] = 'a'

    const other = []
    other[0] = other
    other[1] = 'b'

    const first = serialize(root, { format: 'vdom', scheme: schemes.ink })
    serialize(other, { format: 'vdom', scheme: schemes.ink })
    const second = serialize(root, { format: 'vdom', scheme: schemes.ink })

    assert.deepEqual(second, first)
  })

  test('symbols use the color of their identity', () => {
    const transition = []
    const atom = []
    transition[0] = transition
    transition[1] = atom[0] = atom[1] = atom
    transition.symbol = 'T'
    atom.symbol = 'a'

    const output = serialize(transition, {
      format: 'vdom',
      scheme: schemes.color
    })

    assert.deepEqual(output[2][1].style, output[3][1].style)
  })
})
