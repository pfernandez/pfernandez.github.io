import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { serialize } from '../sexpr.js'
import { countPairs, dyckPrefixStates, dyckWord, generateCatalanPairs,
         normalizePair } from './utils.js'

describe('proofs utilities', () => {
  test('countPairs counts only non-empty pair nodes', () => {
    assert.equal(countPairs('atom'), 0)
    assert.equal(countPairs([]), 0)
    assert.equal(countPairs([[], []]), 1)
    assert.equal(countPairs([[], [[], []]]), 2)
    assert.equal(countPairs([[[], []], [[], []]]), 3)
  })

  test('dyckWord exposes the inspectable Catalan skeleton', () => {
    const cases =
      [['()', ''],
       ['(() ())', '()'],
       ['(() (() ()))', '()()'],
       ['((() ()) ())', '(())'],
       ['((() ()) (() ()))', '(())()']]

    const pairs = generateCatalanPairs(3)

    for (const [shown, expected] of cases) {
      const pair = pairs.find(candidate => serialize(candidate) === shown)
      assert.ok(pair, shown)
      assert.equal(dyckWord(pair), expected, shown)
    }
  })

  test('generateCatalanPairs emits small visually inspectable families in order', () => {
    const pairs = generateCatalanPairs(3)
    const bySize = size =>
      pairs
        .filter(pair => countPairs(pair) === size)
        .map(pair => serialize(pair))

    assert.deepEqual(bySize(0), ['()'])
    assert.deepEqual(bySize(1), ['(() ())'])
    assert.deepEqual(bySize(2), ['(() (() ()))', '((() ()) ())'])
    assert.deepEqual(
      bySize(3),
      ['(() (() (() ())))',
       '(() ((() ()) ()))',
       '((() ()) (() ()))',
       '((() (() ())) ())',
       '(((() ()) ()) ())'])
  })

  test('normalizePair records each collapse in order', () => {
    const pair = [[[], []], [[], []]]
    const normalized = normalizePair(pair)
    const changedPairs = normalized.steps.map(step => serialize(step.after))

    assert.deepEqual(changedPairs, ['(() (() ()))', '(() ())', '()'])
    assert.equal(serialize(normalized.after), '()')
  })

  test('dyckPrefixStates expose the causal counters directly', () => {
    const states = dyckPrefixStates([[[], []], []])

    assert.deepEqual(
      states,
      [{ token: '(', opens: 1, closes: 0, time: 1, position: 1, interval: 0 },
       { token: '(', opens: 2, closes: 0, time: 2, position: 2, interval: 0 },
       { token: ')', opens: 2, closes: 1, time: 3, position: 1, interval: 2 },
       { token: ')', opens: 2, closes: 2, time: 4, position: 0, interval: 4 }])
  })
})
