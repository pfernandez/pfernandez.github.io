import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

describe('observe', () => {
  test('empty', () => assert.deepEqual(observe([]), []))

  test('collapse', () => {
    assert.deepEqual(observe([[], []]), [])
    assert.deepEqual(observe([[], [[], []]]), [[], []])
  })

  test('identity', () => {
    const x = [[], []]
    assert.equal(observe([[], x]), x)
  })

  test('first', () => {
    const x = [[], []]
    const y = [[], []]
    assert.equal(observe([[[], x], y]), x)
  })

  test('next', () => {
    const x = [[], []]
    const y = [[], []]
    const $ = [[[], x], y]
    $[0][0][0] = []
    $[0][0][1] = $[1]
    assert.equal(observe($), y)
  })

  test('bind', () => {
    const x = [[], []]
    const y = [[], []]
    const $ = [[[[], []], x], y]

    $[0][0][1][0] = $[0][1]
    $[0][0][1][1] = $[1]

    assert.deepEqual(observe($), [x, y])
  })

  test('share', () => {
    const x = [[], []]
    const y = [[], []]
    const z = [[], []]
    const $ = [[[[], x], y], z]
    $[0][0][0] = [[], [[$[0][0][1], $[1]], [$[0][1], $[1]]]]

    assert.deepEqual(observe($), [[x, z], [y, z]])
  })

  test('fix', async () => {
    const isAtom = pair => !Array.isArray(pair)
    const isEmpty = pair => !pair.length

    const $ = []
    const x = [[], []]
    $[0] = [[[], $], x]

    assert.deepEqual(observe($), $)
    assert.equal(observe($)[0][1], x)
    assert.ok(!isAtom($))
    assert.ok(!isEmpty($))
  })

  test('nest', () => {
    const x = []
    x[0] = []
    x[1] = [[], x]
    const $ = [[], [[], x]]

    assert.deepEqual(observe($), [[], x])
    assert.deepEqual(observe(observe($)), [[], [[], x]])
  })
})
