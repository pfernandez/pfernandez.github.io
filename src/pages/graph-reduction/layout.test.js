import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { layout } from './layout.js'
import { generateCatalanPairs } from './proofs/utils.js'

const byId = nodes => new Map(nodes.map(node => [node.id, node]))

describe('layout', () => {
  test('anchors the root and uses local offsets', () => {
    const tree = layout([[], [[], 'x']])
    const nodes = byId(tree.nodes)
    const approx = (actual, expected) =>
      assert.equal(Math.abs(actual - expected) < 1e-9, true)

    assert.equal(nodes.get('root').x, 0)
    assert.equal(nodes.get('root0').x, -1)
    assert.equal(nodes.get('root1').x, 1)
    approx(nodes.get('root10').x, 1 / 3)
    approx(nodes.get('root11').x, 5 / 3)
  })

  test('keeps node positions distinct on small Catalan trees', () => {
    for (const pair of generateCatalanPairs(7)) {
      const seen = new Set()

      for (const node of layout(pair).nodes) {
        const key = `${node.x}:${node.y}`
        assert.equal(seen.has(key), false)
        seen.add(key)
      }
    }
  })
})
