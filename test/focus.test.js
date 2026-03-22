import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { serialize } from '../src/pages/graph-reduction/collapse/utils/sexpr.js'
import { focusAt, focusRoot, moveFocus, readFocus,
         replaceFocus, unfocus } from '../src/pages/graph-reduction/focus/index.js'

describe('focus', () => {
  test('focusAt reads visually inspectable paths', () => {
    const term = [[[], []], [[], ['a', 'b']]]

    assert.equal(serialize(readFocus(term, 'root')), '((() ()) (() (a b)))')
    assert.equal(serialize(readFocus(term, 'root0')), '(() ())')
    assert.equal(serialize(readFocus(term, 'root1')), '(() (a b))')
    assert.equal(serialize(readFocus(term, 'root11')), '(a b)')
  })

  test('local focus moves preserve the original root by reference', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    const root = focusRoot(term)
    const left = moveFocus(root, 'left')
    const right = moveFocus(root, 'right')

    assert.ok(left)
    assert.ok(right)
    assert.equal(left.term, term)
    assert.equal(left.focus, term[0])
    assert.equal(left.path, 'root0')
    assert.equal(right.term, term)
    assert.equal(right.focus, term[1])
    assert.equal(right.path, 'root1')

    const back = moveFocus(left, 'up')
    assert.ok(back)
    assert.equal(back.term, term)
    assert.equal(back.focus, term)
    assert.equal(back.path, 'root')
  })

  test('replaceFocus rebuilds only the focused path', () => {
    const keep = [[], ['a', 'b']]
    const term = [[[[], []], 'x'], keep]
    const state = focusAt(term, 'root0')
    const replacement = ['done', 'now']
    const next = replaceFocus(state, replacement)

    assert.equal(next.path, 'root0')
    assert.equal(next.focus, replacement)
    assert.equal(next.term[1], keep)
    assert.equal(serialize(next.term), '((done now) (() (a b)))')
  })

  test('unfocus returns to the original root reference after pure movement', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    const state = focusAt(term, 'root11')
    const root = unfocus(state)

    assert.equal(root.term, term)
    assert.equal(root.focus, term)
    assert.equal(root.path, 'root')
  })

  test('focusAt rejects invalid paths', () => {
    const term = [[[], []], [[], ['a', 'b']]]
    assert.throws(() => focusAt(term, 'left'), /start at root/)
    assert.throws(() => focusAt(term, 'root2'), /0 and 1/)
    assert.throws(() => focusAt(term, 'root000'), /Cannot focus/)
  })
})
