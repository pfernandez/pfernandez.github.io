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
  const current = (...directions) => path(right, ...directions)
  const result = (fn, argument) => [
    path(left),
    join(fn, argument)
  ]
  return {
    current,
    graph: pair,
    join,
    left,
    path,
    result,
    right
  }
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

const recurrence = ({ current, join, left, result, right }) => {
  const fn = result(
    current(left),
    join(
      current(right),
      current(right, right, right)
    )
  )
  return fn
}

test('grows history around a fixed configuration', () => {
  const syntax = language()
  const focus = fixed()
  const origin = observer(focus)
  const fn = recurrence(syntax)
  const initial = [syntax.graph, [fn, origin]]
  const first = unfold(initial)
  const second = unfold(first)
  const state = unfold(second)
  const events = visits(origin, state[1][1])

  assert.equal(state[0], syntax.graph)
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

  const origin = observer(first)
  const fn = recurrence(syntax)
  const initial = [syntax.graph, [fn, origin]]
  const once = unfold(initial)
  const twice = unfold(once)
  const state = unfold(twice)
  const events = visits(origin, state[1][1])
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
  const { current, join, left, result, right } = syntax
  const same = result(
    current(right, left, left),
    join(
      current(right, left, right),
      join(current(right, right), current(right, right, right))
    )
  )
  const next = result(
    current(right, left, left),
    join(
      current(right, left, right),
      join(
        current(right, right),
        current(right, right, right, right)
      )
    )
  )
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

  const origin = observer(first)
  const initial = [syntax.graph, [same, [afterSame, origin]]]
  const state = unfold(unfold(initial))
  const events = visits(origin, state[1][1][1])

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
  const { current, join, left, path, right } = syntax
  const toFunction = current(right, left)
  const toArgument = join(
    current(left),
    current(right, right)
  )
  const value = fixed()
  const construct = []
  const known = [path(left), join(toFunction, toArgument)]
  const argument = [known, value]
  construct[0] = path(left)
  construct[1] = join(
    join(
      current(right, left, left),
      current(right, left, right)
    ),
    join(current(left), current(right, right))
  )

  const initial = [syntax.graph, [construct, argument]]
  const entered = unfold(initial)
  const call = entered[1]
  const constructed = call[1][0]

  assert.equal(entered[0], syntax.graph)
  assert.notEqual(constructed, known)
  assert.equal(constructed[0], known[0])
  assert.equal(constructed[1], known[1])
  assert.equal(call[0], construct)
  assert.equal(call[1][1], value)
})
