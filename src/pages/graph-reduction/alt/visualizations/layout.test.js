import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { layout } from './layout.js'

describe('layout', () => {
  test('lays out leaves and the empty boundary', () => {
    assert.deepEqual(layout('a'), {
      nodes: [{ id: 'root', kind: 'leaf', label: 'a', x: 0, y: 0 }],
      edges: [],
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 1,
      height: 1
    })

    assert.deepEqual(layout([]), {
      nodes: [{ id: 'root', kind: 'empty', label: '()', x: 0, y: 0 }],
      edges: [],
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 1,
      height: 1
    })
  })

  test('lays out pairs between their children', () => {
    assert.deepEqual(layout(['a', 'b']), {
      nodes: [
        { id: 'root0', kind: 'leaf', label: 'a', x: 0, y: 1 },
        { id: 'root1', kind: 'leaf', label: 'b', x: 1, y: 1 },
        { id: 'root', kind: 'pair', label: '·', x: 0.5, y: 0 }
      ],
      edges: [
        { from: 'root', to: 'root0' },
        { from: 'root', to: 'root1' }
      ],
      minX: 0,
      maxX: 1,
      minY: 0,
      maxY: 1,
      width: 1,
      height: 2
    })
  })

  test('rejects malformed arrays', () =>
    assert.throws(() => layout(['a']), /empty or pairs/i))
})

