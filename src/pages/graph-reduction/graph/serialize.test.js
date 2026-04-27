import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parse, serialize } from './index.js'

const parseTerm = source => parse(source)[0]

describe('serialize', () => {
  test('serialize writes canonical atoms and pairs', () => {
    assert.equal(serialize('foo'), 'foo')
    assert.equal(serialize(42), '42')
    assert.equal(serialize([]), '()')
    assert.equal(serialize([[], 'x']), '(() x)')
    assert.equal(serialize([['a', 'b'], ['c', ['d', 'e']]]),
                 '((a b) (c (d e)))')
  })

  test('serialize round-trips parsed terms', () =>
    ['foo',
     '42',
     '()',
     '(a b)',
     '((() a) (() b))',
     '; comment\n((a b) ; inline\n (c d))'].forEach(source => {
      const pair = parseTerm(source)
      assert.deepEqual(parseTerm(serialize(pair)), pair)
    }))
})
