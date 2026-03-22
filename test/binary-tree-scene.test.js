import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { render } from '@pfern/elements'
import { createFakeDom } from '../../elements/packages/elements/test/fake-dom.js'
import { parse } from '../src/pages/graph-reduction/collapse/utils/sexpr.js'
import { renderBinaryTreeScene }
  from '../src/pages/graph-reduction/visualizations/binary-tree-scene.js'

const makeWindow = extra =>
  ({
    location: { pathname: '/', search: '', hash: '' },
    history: { pushState: () => {} },
    ...extra
  })

const walk = (node, visit) => {
  if (!node) return
  visit(node)
  for (const child of node.childNodes || []) {
    walk(child, visit)
  }
}

const countTag = (root, tagName) => {
  let count = 0
  walk(root, node => {
    if (node.tagName?.toLowerCase() === tagName) count++
  })
  return count
}

describe('binary tree scene', () => {
  test('stable-to-reset snapshot restores the full tree', () => {
    const prevDocument = globalThis.document
    const prevWindow = globalThis.window
    const { document } = createFakeDom()
    globalThis.document = document
    globalThis.window = makeWindow()

    try {
      const container = document.createElement('div')
      const initial = parse('((() ()) (() (a b)))')
      const stable = parse('(a b)')

      render(renderBinaryTreeScene(initial), container)
      const initialCircles = countTag(container, 'circle')
      const initialLines = countTag(container, 'line')

      render(renderBinaryTreeScene(stable), container)
      assert.equal(countTag(container, 'circle'), 3)
      assert.equal(countTag(container, 'line'), 2)

      render(renderBinaryTreeScene(initial), container)
      assert.equal(countTag(container, 'circle'), initialCircles)
      assert.equal(countTag(container, 'line'), initialLines)
    } finally {
      globalThis.document = prevDocument
      globalThis.window = prevWindow
    }
  })
})
