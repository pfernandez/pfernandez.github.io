import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observe } from './observe.js'
import { unfold } from './unfold.js'

const fixed = () => {
  const identity = []
  identity[0] = identity[1] = identity
  return identity
}

const language = () => {
  const left = fixed()
  const right = [left, left]
  const pair = [left, right]
  const path = (...directions) =>
    directions.reduceRight((rest, direction) =>
      [direction, rest], left)
  const join = (before, after) => [pair, [before, after]]
  return { graph: [left, pair], join, left, path, right }
}

const observer = focus => {
  const root = []
  root[0] = root
  root[1] = focus
  return root
}

const visits = (origin, history, result = []) =>
  history === origin
    ? [origin, ...result]
    : visits(origin, history[0], [history, ...result])

const recurrence = ({ join, left, path, right }) => {
  const fn = [
    path(left),
    join(
      path(right),
      path(right, right, right)
    )
  ]
  return fn
}

test('grows history around a fixed configuration', () => {
  const syntax = language()
  const focus = fixed()
  const root = observer(focus)
  const fn = recurrence(syntax)
  const initial = [fn, root]
  const first = unfold(syntax.graph, initial)
  const second = unfold(syntax.graph, first)
  const state = unfold(syntax.graph, second)
  const events = visits(root, state[1])

  assert.equal(new Set(events).size, 4)
  assert.deepEqual(events.map(event => event[1]), [
    focus,
    focus,
    focus,
    focus
  ])
})

test('unfolds recurrent configurations into distinct visits', () => {
  const syntax = language()
  const first = []
  const second = []
  first[0] = first
  first[1] = second
  second[0] = second
  second[1] = first

  const root = observer(first)
  const fn = recurrence(syntax)
  const initial = [fn, root]
  const once = unfold(syntax.graph, initial)
  const twice = unfold(syntax.graph, once)
  const state = unfold(syntax.graph, twice)
  const events = visits(root, state[1])
  const configurations = events.map(event => event[1])

  assert.deepEqual(configurations, [
    first,
    second,
    first,
    second
  ])
  assert.deepEqual(configurations.slice(0, 3), observe(first).steps)
  assert.equal(new Set(events).size, 4)
  assert.equal(new Set(configurations).size, 2)
})

test('lets recurrent functions select one another', () => {
  const syntax = language()
  const { join, left, path, right } = syntax
  const same = [
    path(right, left, left),
    join(
      path(right, left, right),
      join(path(right, right), path(right, right, right))
    )
  ]
  const next = [
    path(right, left, left),
    join(
      path(right, left, right),
      join(path(right, right), path(right, right, right, right))
    )
  ]
  const afterSame = []
  const afterNext = [same, afterSame]
  afterSame[0] = next
  afterSame[1] = afterNext

  const first = []
  const second = []
  first[0] = first
  first[1] = second
  second[0] = second
  second[1] = first

  const root = observer(first)
  const initial = [same, [afterSame, root]]
  const state = unfold(syntax.graph, unfold(syntax.graph, initial))
  const events = visits(root, state[1][1])

  assert.deepEqual(events.map(event => event[1]), [
    first,
    first,
    second,
    second,
    first
  ])
})

test('constructs and enters a new function', () => {
  const syntax = language()
  const { join, left, path, right } = syntax
  const toFunction = path(right, left)
  const toArgument = join(
    path(left),
    path(right, right)
  )
  const value = fixed()
  const construct = []
  const known = [toFunction, toArgument]
  const argument = [known, value]
  construct[0] = join(
    path(right, left, left),
    path(right, left, right)
  )
  construct[1] = join(path(left), path(right, right))

  const initial = [construct, argument]
  const entered = unfold(syntax.graph, initial)
  const constructed = entered[1][0]

  assert.notEqual(constructed, known)
  assert.equal(constructed[0], known[0])
  assert.equal(constructed[1], known[1])
  assert.equal(entered[0], construct)
  assert.equal(entered[1][1], value)
})
