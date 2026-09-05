import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link } from '../../graph/index.js'
import { unfold } from './direct.js'
import { expand } from './expand.js'

const compile = source => {
  const linked = link(source)
  if (linked.error) throw linked.error
  return linked
}

const output = linked => linked.focus[1]

const fixed = () => {
  const identity = []
  identity[0] = identity[1] = identity
  return identity
}

const language = () => {
  const self = fixed()
  const make = [self, self]
  const pair = [self, make]
  const join = (before, after) => [make, [before, after]]
  return { join, pair, self }
}

test('the compiler links native functions as direct references', () => {
  const identity = compile('((identity x x) (identity A))')
  const first = compile('((first (x y) x) (first (A B)))')
  const second = compile('((second (x y) y) (second (A B)))')
  const duplicate = compile('((duplicate x (x x)) (duplicate A))')
  const swap = compile('((swap (x y) (y x)) (swap (A B)))')
  assert.equal(output(identity), identity.focus[0])
  assert.equal(output(first), first.focus[0][0])
  assert.equal(output(second), second.focus[0][1])
  assert.equal(output(duplicate)[0], duplicate.focus[0])
  assert.equal(output(duplicate)[1], duplicate.focus[0])
  assert.equal(output(swap)[0], swap.focus[0][1])
  assert.equal(output(swap)[1], swap.focus[0][0])
})

test('returns an already connected target without a path', () => {
  const { join, pair } = language()
  const target = fixed()
  const fn = []
  fn[0] = pair
  fn[1] = join(fn, target)

  const result = unfold([pair, [fn, fixed()]])

  assert.equal(result[0], pair)
  assert.equal(result[1][0], fn)
  assert.equal(result[1][1], target)
})

test('grows history through only the current root', () => {
  const { join, pair, self } = language()
  const focus = fixed()
  const fn = []
  fn[0] = pair
  fn[1] = join(fn, join(self, focus))

  const initial = [pair, [fn, focus]]
  const first = unfold(initial)
  const second = unfold(first)

  assert.equal(first[1][1][0], initial)
  assert.equal(first[1][1][1], focus)
  assert.equal(second[1][1][0], first)
  assert.equal(second[1][1][1], focus)
})

test('expands a finite orbit into direct transition functions', () => {
  const { join, pair, self } = language()
  const A = fixed()
  const B = fixed()
  // These placeholders introduce both identities before either body is
  // connected. Raw source needs an equivalent enclosing scope.
  const first = []
  const second = []
  first[0] = pair
  first[1] = join(second, join(self, B))
  second[0] = pair
  second[1] = join(first, join(self, A))

  const initial = [pair, [first, A]]
  const result = unfold(initial)
  const middle = result[1][1][0]

  assert.equal(middle[1][0], second)
  assert.equal(middle[1][1][1], B)
  assert.equal(result[1][0], first)
  assert.equal(result[1][1][1], A)
})

test('carries history through a linked recurrent graph', () => {
  const linked = compile(`
    ((swap (x y) (swap (y x)))
     (swap (A B)))
  `)
  const { pair } = language()
  const initial = expand(pair, linked.focus)
  const result = unfold(initial)
  const middle = result[1][1][0]

  assert.equal(middle[1][1][0], initial)
  assert.equal(middle[1][1][1], linked.focus[1])
  assert.notEqual(middle[1][0], initial[1][0])
  assert.equal(result[1][1][0], middle)
  assert.equal(result[1][1][1], linked.focus)
  assert.equal(result[1][0], initial[1][0])
})
