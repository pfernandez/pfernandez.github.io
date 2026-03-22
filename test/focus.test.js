import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { serialize } from '../src/pages/graph-reduction/collapse/utils/sexpr.js'
import { observeAt, observeRoot, readOrigin,
         recenter, replaceOrigin, shiftOrigin }
  from '../src/pages/graph-reduction/focus/index.js'

describe('focus as observer frame', () => {
  test('observeAt reads visually inspectable origin addresses', () => {
    const term = [[[], []], [[], ['a', 'b']]]

    assert.equal(serialize(readOrigin(term, 'root')), '((() ()) (() (a b)))')
    assert.equal(serialize(readOrigin(term, 'root0')), '(() ())')
    assert.equal(serialize(readOrigin(term, 'root1')), '(() (a b))')
    assert.equal(serialize(readOrigin(term, 'root11')), '(a b)')
  })

  test('local origin shifts preserve the substrate by reference', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    const root = observeRoot(term)
    const left = shiftOrigin(root, 'left')
    const right = shiftOrigin(root, 'right')

    assert.ok(left)
    assert.ok(right)
    assert.equal(left.substrate, term)
    assert.equal(left.origin, term[0])
    assert.equal(left.address, 'root0')
    assert.equal(right.substrate, term)
    assert.equal(right.origin, term[1])
    assert.equal(right.address, 'root1')

    const back = shiftOrigin(left, 'up')
    assert.ok(back)
    assert.equal(back.substrate, term)
    assert.equal(back.origin, term)
    assert.equal(back.address, 'root')
  })

  test('replaceOrigin rebuilds only the addressed path', () => {
    const keep = [[], ['a', 'b']]
    const term = [[[[], []], 'x'], keep]
    const state = observeAt(term, 'root0')
    const replacement = ['done', 'now']
    const next = replaceOrigin(state, replacement)

    assert.equal(next.address, 'root0')
    assert.equal(next.origin, replacement)
    assert.equal(next.substrate[1], keep)
    assert.equal(serialize(next.substrate), '((done now) (() (a b)))')
  })

  test('recenter returns to the original root reference after pure movement', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    const state = observeAt(term, 'root11')
    const root = recenter(state)

    assert.equal(root.substrate, term)
    assert.equal(root.origin, term)
    assert.equal(root.address, 'root')
  })

  test('observeAt rejects invalid addresses', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    assert.throws(() => observeAt(term, 'left'), /start at root/)
    assert.throws(() => observeAt(term, 'root2'), /0 and 1/)
    assert.throws(() => observeAt(term, 'root000'), /Cannot focus/)
  })
})
