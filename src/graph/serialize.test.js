import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  schemeNames,
  schemes,
  serialize
} from './index.js'

const legend = new Map()
const identify = (graph, name) => {
  legend.set(graph, { name })
  return graph
}
const print = (graph, options = {}) => serialize(graph, { legend, ...options })

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

  test('ansi colors do not change formatted output', () => {
    const root = []
    root[0] = root
    root[1] = ['a', 'b']
    const options = { format: 'ansi', width: 5 }
    const plain = serialize(root, { ...options, scheme: schemes.plain })
    const color = serialize(root, { ...options, scheme: schemes.color })

    assert.match(color, /\x1b\[38;/)
    assert.equal(color.replace(/\x1b\[[0-9;]+m/g, ''), plain)
    assert.match(plain, /\n/)
  })

  test('replaces references with symbols in arbitrary sequences', () => {
    const x = []
    const y = []
    x[0] = x[1] = x
    y[0] = y[1] = y
    identify(x, 'x')
    identify(y, 'y')
    const graph = [x, [y, x], []]
    const expected = '(x (y x) ())'

    assert.equal(print(graph), expected)
    assert.equal(
      print(graph, { width: 10 }),
      '(x\n (y x)\n ())')
  })

  test('optionally restores labels removed from named pairs', () => {
    const before = []
    const after = []
    const transition = [before, after]
    before[0] = before[1] = before
    after[0] = after[1] = after
    identify(before, 'before')
    identify(after, 'after')
    identify(transition, 'step')

    assert.equal(print(transition), '(before after)')
    assert.equal(
      print(transition, { labels: true }),
      '(step before after)')
  })

  test('renders a selected graph within its preceding context', () => {
    const b = []
    const c = []
    b[0] = b[1] = b
    c[0] = c[1] = c
    const args = [b, c]
    const result = [[args, c], [b, c]]
    const root = [args, result]
    identify(args, 'a')
    identify(b, 'b')
    identify(c, 'c')

    assert.equal(
      print(result, { context: root, labels: true }),
      '((a c) (b c))')
  })

  test('does not duplicate a label that occupies the left state', () => {
    const following = []
    const transition = []
    following[0] = following[1] = following
    identify(following, 'following')
    transition[0] = transition
    transition[1] = following
    identify(transition, 'step')

    assert.equal(print(transition, { labels: true }), '(step following)')
  })

  test('prints the names of function identities instead of their source', () => {
    const identity = []
    identity[0] = identity[1] = identity
    identify(identity, 'render')

    assert.equal(print(identity), 'render')
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
    identify(transition, 'T')
    identify(atom, 'a')

    const output = print(transition, {
      format: 'vdom',
      scheme: schemes.color
    })

    assert.deepEqual(output[2][1].style, output[3][1].style)
  })
})
