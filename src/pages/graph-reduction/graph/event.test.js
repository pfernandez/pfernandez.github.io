import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { image } from '../wasm/image.js'
import { depth, event, link, tick } from './index.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

const assertPairs = root => {
  const pending = [root]
  const seen = new Set()

  while (pending.length) {
    const pair = pending.pop()
    if (seen.has(pair)) continue
    seen.add(pair)
    assert.equal(Array.isArray(pair), true)
    assert.equal(pair.length, 2)
    pending.push(pair[0], pair[1])
  }
}

describe('events', () => {
  test('counting lives in history, not repeated focus identity', () => {
    const { graph } = linked(readFileSync(
      new URL('../history.graph.lisp', import.meta.url),
      'utf-8'))
    const sourceSize = image(graph).addresses.size
    const current = event(graph)
    const foci = []

    for (let i = 0; i < 12; i++) {
      assert.equal(depth(current), i)
      foci.push(current[0])
      tick(current)
    }

    assert.equal(depth(current), 12)
    assert.equal(new Set(foci).size < foci.length, true)
    assert.equal(image(graph).addresses.size, sourceSize)
    assertPairs(current)
    assert.doesNotThrow(() => image(current))
  })
})
