import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  link,
  serialize
} from './index.js'

const core = `
(((((I x) x)
  (((K x) y) x))
  ((((S x) y) z) ((x z) (y z))))
 ((K a) b))
`

const named = legend => Object.fromEntries(
  legend.map(({ node, symbol }, index) => [`${symbol}${index}`, node]))

describe('link', () => {
  test('links source text', () => {
    const { graph, legend, error } = link(core)

    assert.equal(error, undefined)
    assert.equal(
      serialize(graph, { legend, expand: false }),
      '(((I K) S) ((K a) b))')
    assert.equal(
      serialize(graph, { legend }),
      [
        '(((((I x) x)',
        '    (((K x) y) x))',
        '   ((((S x) y) z) ((x z) (y z))))',
        '  ((K a) b))'
      ].join('\n'))
  })

  test('wires the current core graph', () => {
    const { graph, legend, error } = link(core)
    assert.equal(error, undefined)

    const {
      I0: I,
      x1: Ix,
      K2: K,
      x3: Kx,
      y4: Ky,
      S5: S,
      x6: Sx,
      y7: Sy,
      z8: Sz,
      a9: a,
      b10: b
    } = named(legend)

    assert.equal(
      serialize(graph, { legend, expand: false }),
      '(((I K) S) ((K a) b))')
    assert.deepEqual(
      legend.map(({ symbol }) => symbol),
      ['I', 'x', 'K', 'x', 'y', 'S', 'x', 'y', 'z', 'a', 'b'])

    assert.equal(graph[0][0][0], I)
    assert.equal(graph[0][0][1], K)
    assert.equal(graph[0][1], S)
    assert.equal(graph[1][0][0], K)
    assert.equal(graph[1][0][1], a)
    assert.equal(graph[1][1], b)

    assert.equal(I[0][0], I)
    assert.equal(I[0][1], Ix)
    assert.equal(I[1], Ix)

    assert.equal(K[0][0][0], K)
    assert.equal(K[0][0][1], Kx)
    assert.equal(K[0][1], Ky)
    assert.equal(K[1], Kx)

    assert.equal(S[0][0][0][0], S)
    assert.equal(S[0][0][0][1], Sx)
    assert.equal(S[0][0][1], Sy)
    assert.equal(S[0][1], Sz)
    assert.equal(S[1][0][0], Sx)
    assert.equal(S[1][0][1], Sz)
    assert.equal(S[1][1][0], Sy)
    assert.equal(S[1][1][1], Sz)

    for (const node of [Ix, Kx, Ky, Sx, Sy, Sz, a, b]) {
      assert.equal(node[0], node)
      assert.equal(node[1], node)
    }
  })
})
