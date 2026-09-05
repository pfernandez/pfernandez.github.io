import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link } from '../graph/index.js'
import { observe } from './observe.js'

const identities = root => {
  const seen = new Set()
  const visit = node => {
    if (!Array.isArray(node) || seen.has(node)) return
    seen.add(node)
    node.forEach(visit)
  }
  visit(root)
  return seen
}

const isomorphic = (
  left,
  right,
  forward = new Map(),
  reverse = new Map()
) => {
  if (!Array.isArray(left) || !Array.isArray(right))
    return Object.is(left, right)
  if (forward.has(left)) return forward.get(left) === right
  if (reverse.has(right)) return false

  forward.set(left, right)
  reverse.set(right, left)
  return isomorphic(left[0], right[0], forward, reverse)
    && isomorphic(left[1], right[1], forward, reverse)
}

test('one identity forms the smallest closed observation', () => {
  const identity = []
  identity[0] = identity[1] = identity

  assert.equal(identities(identity).size, 1)
  assert.deepEqual(observe(identity), {
    focus: identity,
    steps: [identity]
  })
})

test('two identities separate an observation from its origin', () => {
  const observation = []
  const origin = [observation]
  observation[0] = observation[1] = observation
  origin[1] = origin

  assert.equal(identities(origin).size, 2)
  assert.deepEqual(observe(origin), {
    focus: origin,
    steps: [origin]
  })
})

test('two identities form a period-two right orbit', () => {
  const first = []
  const second = []
  first[0] = first
  first[1] = second
  second[0] = second
  second[1] = first

  assert.equal(identities(first).size, 2)
  assert.deepEqual(observe(first), {
    focus: first,
    steps: [first, second, first]
  })
})

test('authored recurrence matches its direct five-identity graph', () => {
  const linked = link(`
  ((swap (x y) (swap (y x)))
   (swap (a b)))
  `)
  if (linked.error) throw linked.error

  const b = []
  const a = []
  const reversed = [b, a]
  const first = [a]
  const second = [reversed, first]
  a[0] = a
  a[1] = b
  b[0] = b[1] = b
  first[1] = second

  assert.equal(identities(linked.focus).size, 5)
  assert.equal(identities(first).size, 5)
  assert.equal(isomorphic(linked.focus, first), true)
  assert.deepEqual(observe(linked.focus).steps, [
    linked.focus,
    linked.focus[1],
    linked.focus
  ])
})

test('walks to a fixed observation', () => {
  const b = []
  const c = []
  const application = [c, c]
  const focus = [b, application]
  b[0] = b[1] = b
  c[0] = c[1] = c

  assert.deepEqual(observe(focus), {
    focus: c,
    steps: [focus, application, c]
  })
})

test('stops when a longer orbit returns to its origin', () => {
  const a = []
  const b = []
  const c = []
  a[0] = a
  a[1] = b
  b[0] = b
  b[1] = c
  c[0] = c
  c[1] = a

  assert.deepEqual(observe(a), {
    focus: a,
    steps: [a, b, c, a]
  })
})
