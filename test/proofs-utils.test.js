import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { serialize } from '../src/pages/graph-reduction/collapse/utils/sexpr.js'
import { countPairs, dyckPrefixStates, dyckWord, generateCatalanPairs,
         normalizeTerm } from '../src/pages/graph-reduction/proofs/utils.js'

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
      const term = pairs.find(pair => serialize(pair) === shown)
      assert.ok(term, shown)
      assert.equal(dyckWord(term), expected, shown)
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

  test('normalizeTerm records each changed term before the final stable trace', () => {
    const term = [[[], []], [[], []]]
    const normalized = normalizeTerm(term)
    const changedTerms =
      normalized.steps
        .filter(step => step.changed)
        .map(step => serialize(step.after))

    assert.deepEqual(changedTerms, ['(() (() ()))', '(() ())', '()'])
    assert.equal(normalized.steps.at(-1)?.changed, false)
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
