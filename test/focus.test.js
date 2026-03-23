import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { serialize } from '../src/pages/graph-reduction/collapse/utils/sexpr.js'
import { centerOn, centerRoot, pan, readCentered,
         replaceCentered, returnToRoot }
  from '../src/pages/graph-reduction/focus/index.js'

describe('focus as observer frame', () => {
  test('centerOn reads visually inspectable addresses', () => {
    const term = [[[], []], [[], ['a', 'b']]]

    assert.equal(serialize(readCentered(term, 'root')), '((() ()) (() (a b)))')
    assert.equal(serialize(readCentered(term, 'root0')), '(() ())')
    assert.equal(serialize(readCentered(term, 'root1')), '(() (a b))')
    assert.equal(serialize(readCentered(term, 'root11')), '(a b)')
  })

  test('local pans preserve the substrate by reference', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    const root = centerRoot(term)
    const left = pan(root, 'left')
    const right = pan(root, 'right')

    assert.ok(left)
    assert.ok(right)
    assert.equal(left.substrate, term)
    assert.equal(left.centered, term[0])
    assert.equal(left.address, 'root0')
    assert.equal(right.substrate, term)
    assert.equal(right.centered, term[1])
    assert.equal(right.address, 'root1')

    const back = pan(left, 'up')
    assert.ok(back)
    assert.equal(back.substrate, term)
    assert.equal(back.centered, term)
    assert.equal(back.address, 'root')
  })

  test('replaceCentered rebuilds only the addressed path', () => {
    const keep = [[], ['a', 'b']]
    const term = [[[[], []], 'x'], keep]
    const state = centerOn(term, 'root0')
    const replacement = ['done', 'now']
    const next = replaceCentered(state, replacement)

    assert.equal(next.address, 'root0')
    assert.equal(next.centered, replacement)
    assert.equal(next.substrate[1], keep)
    assert.equal(serialize(next.substrate), '((done now) (() (a b)))')
  })

  test('returnToRoot recovers the whole substrate after pure movement', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    const state = centerOn(term, 'root11')
    const root = returnToRoot(state)

    assert.equal(root.substrate, term)
    assert.equal(root.centered, term)
    assert.equal(root.address, 'root')
  })

  test('centerOn rejects invalid addresses', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    assert.throws(() => centerOn(term, 'left'), /start at root/)
    assert.throws(() => centerOn(term, 'root2'), /0 and 1/)
    assert.throws(() => centerOn(term, 'root000'), /Cannot center/)
  })
})
