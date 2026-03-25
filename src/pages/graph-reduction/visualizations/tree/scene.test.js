import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { render } from '@pfern/elements'
import { parse } from '../../sexpr.js'
import { mockDom, mockWindow } from '../../../../testing/mock.js'
import { scene } from './scene.js'

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

describe('tree scene', () => {
  test('stable-to-reset snapshot restores the full tree', () => {
    const prevDocument = globalThis.document
    const prevWindow = globalThis.window
    const { document } = mockDom()
    globalThis.document = document
    globalThis.window = mockWindow()

    try {
      const container = document.createElement('div')
      const initial = parse('((() ()) (() (a b)))')
      const stable = parse('(a b)')

      render(scene(initial), container)
      const initialCircles = countTag(container, 'circle')
      const initialLines = countTag(container, 'line')

      render(scene(stable), container)
      assert.equal(countTag(container, 'circle'), 3)
      assert.equal(countTag(container, 'line'), 2)

      render(scene(initial), container)
      assert.equal(countTag(container, 'circle'), initialCircles)
      assert.equal(countTag(container, 'line'), initialLines)
    } finally {
      globalThis.document = prevDocument
      globalThis.window = prevWindow
    }
  })
})
