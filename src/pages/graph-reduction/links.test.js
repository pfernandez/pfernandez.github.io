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

  test('reports contextual links by source and target path', () => {
    const refs = []

    build(parse('(() (() (() ((#2 #0) (#1 #0)))))'),
          ref => refs.push(ref))

    assert.deepEqual(refs,
                     [{ from: 'root11100', to: 0, toPath: 'root0', depth: 2 },
                      { from: 'root11101', to: 2, toPath: 'root110', depth: 0 },
                      { from: 'root11110', to: 1, toPath: 'root10', depth: 1 },
                      { from: 'root11111', to: 2, toPath: 'root110', depth: 0 }])
  })

  test('rejects out-of-scope links', () => {
    assert.throws(() => build(parse('(() #1)')),
                  /Out-of-scope link: #1/)
  })
})
