import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { collapse } from './collapse.js'
import { build, collapse as reduce, materialize } from './links.js'
import { parse, serialize } from './sexpr.js'

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

  test('keeps collecting in-scope refs after reduction', () => {
    const refs = []
    const pair = collapse(parse('(() (() (() ((#2 #0) (#1 #0)))))'))

    assert.doesNotThrow(() => build(pair, ref => refs.push(ref)))
    assert.deepEqual(refs,
                     [{ from: 'root1101', to: 1, toPath: 'root10', depth: 0 },
                      { from: 'root1110', to: 0, toPath: 'root0', depth: 1 },
                      { from: 'root1111', to: 1, toPath: 'root10', depth: 0 }])
  })

  test('does not reduce a bare binder', () => {
    const [root, links] = build(parse('(() #0)'))
    const [nextRoot, nextLinks] = reduce(root, links)

    assert.equal(nextRoot, root)
    assert.equal(nextLinks, links)
  })

  test('reduces I x directly in the link machine', () => {
    let state = build(parse('((() #0) x)'))
    state = reduce(...state)

    assert.equal(materialize(...state), 'x')
  })

  test('reduces K a b directly in the link machine', () => {
    let state = build(parse('(((() (() #1)) a) b)'))
    state = reduce(...state)
    state = reduce(...state)

    assert.equal(materialize(...state), 'a')
  })

  test('reduces S a b c directly in the link machine', () => {
    let state = build(parse('((((() (() (() ((#2 #0) (#1 #0))))) a) b) c)'))
    state = reduce(...state)
    state = reduce(...state)
    state = reduce(...state)

    assert.deepEqual(materialize(...state),
                     [['a', 'c'],
                      ['b', 'c']])
  })

  test('preserves shared arguments by identity', () => {
    let state = build(parse('((((() (() (() ((#2 #0) (#1 #0))))) a) b) (u v))'))
    state = reduce(...state)
    state = reduce(...state)
    state = reduce(...state)

    const ids = new Map()
    const pair = materialize(...state, ids)

    assert.deepEqual(pair,
                     [['a', ['u', 'v']],
                      ['b', ['u', 'v']]])
    assert.equal(ids.get('root01'), ids.get('root11'))
  })

  test('materializes binder-relative refs for S a b c', () => {
    let state = build(parse('((((() (() (() ((#2 #0) (#1 #0))))) a) b) c)'))

    assert.equal(serialize(materialize(...state)),
                 '((((() (() (() ((#2 #0) (#1 #0))))) a) b) c)')

    state = reduce(...state)
    assert.equal(serialize(materialize(...state)),
                 '(((() (() ((a #0) (#1 #0)))) b) c)')

    state = reduce(...state)
    assert.equal(serialize(materialize(...state)),
                 '((() ((a #0) (b #0))) c)')
  })
})
