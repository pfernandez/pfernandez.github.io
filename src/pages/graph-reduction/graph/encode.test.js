import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { construct, encode, parse, serialize } from './index.js'

const encoded = source => encode(parse(source))

const reparsed = value => {
  const { graph, sequence } = construct(value)
  return parse(serialize(graph, sequence))[0]
}

describe('encode', () => {
  test('encode returns () for blank programs', () => {
    assert.deepEqual(encoded(''), [])
    assert.deepEqual(encoded(' \n\t '), [])
  })

  test('encode leaves plain terms as left-associated arrays', () => {
    assert.equal(encoded('name'), 'name')
    assert.equal(encoded('7'), 7)
    assert.deepEqual(encoded('(f x y z)'), [[['f', 'x'], 'y'], 'z'])
  })

  test('encode expands aliases and templates', () => {
    assert.deepEqual(encoded(`
      (def I (() 0))
      (def id I)
      ((id a) b)
    `), [[[[], 0], 'a'], 'b'])
    assert.deepEqual(encoded(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `), [[[[[0, 2], [1, 2]], 'a'], 'b'], 'c'])
  })

  test('construct and serialize round-trip encoded terms', () =>
    ['',
     '()',
     '(f x y)',
     '(defn I (x) x)\n(I a)',
     '(defn K (x y) x)\n((K a) b)',
     '(defn S (x y z) ((x z) (y z)))\n(((S a) b) c)',
     '(def S ((0 2) (1 2)))\n(((S a) b) c)',
     '(defn F (x) (x y))\n((F a) b)'].forEach(source => {
      const value = encoded(source)
      assert.deepEqual(reparsed(value), value, source)
    }))

  test('different encoded terms can build the same multiway graph', () => {
    const left = parse('(((((0 2) (1 2)) a) b) c)')[0]
    const right = parse('(((((0 1) (2 1)) a) c) b)')[0]

    const leftState = construct(left)
    const rightState = construct(right)

    assert.deepEqual(serialize(leftState.graph, leftState.sequence),
                     '(((((0 2) (1 2)) a) b) c)')
    assert.deepEqual(serialize(rightState.graph, rightState.sequence),
                     '(((((0 1) (2 1)) a) c) b)')
    assert.deepEqual(leftState.graph, rightState.graph)
    assert.notDeepEqual(leftState.sequence, rightState.sequence)
  })
})
