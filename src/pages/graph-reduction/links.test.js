import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { build } from './links.js'
import { parse } from './sexpr.js'

describe('links', () => {
  test('lowers plain pairs into root and links', () => {
    assert.deepEqual(build(parse('((() a) b)')),
                     [0,
                      [[1, 'b'],
                       [null, 'a']]])
  })

  test('resolves I against the nearest binder', () => {
    assert.deepEqual(build(parse('(() #0)')),
                     [0, [[null, 0]]])
  })

  test('resolves K against the next binder out', () => {
    assert.deepEqual(build(parse('(() (() #1))')),
                     [0,
                      [[null, 1],
                       [null, 0]]])
  })

  test('resolves S into direct contextual links', () => {
    assert.deepEqual(build(parse('(() (() (() ((#2 #0) (#1 #0)))))')),
                     [0,
                      [[null, 1],
                       [null, 2],
                       [null, 3],
                       [4, 5],
                       [0, 2],
                       [1, 2]]])
  })

  test('rejects out-of-scope links', () => {
    assert.throws(() => build(parse('(() #1)')),
                  /Out-of-scope link: #1/)
  })
})
