import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { I, collapse, fix, left, observe, pair, right,
         setLeft, setRight, share, size } from './core.js'

const reset = () => {
  I.length = 2
  I[0] = I
  I[1] = I
  return I
}

describe('graph core', () => {
  describe('graph', () => {
    test('I is the root fixed point, not an allocated pair', () => {
      const graph = reset()

      assert.equal(graph, I)
      assert.equal(size(), 0)
      assert.equal(left(I), I)
      assert.equal(right(I), I)
    })

    test('pair creates identity', () => {
      reset()
      const a = pair()
      const b = pair()

      assert.notEqual(a, I)
      assert.notEqual(b, I)
      assert.notEqual(a, b)
      assert.equal(size(), 2)
    })

    test('shared child stays shared by identity', () => {
      reset()
      const child = pair()
      const first = pair(child, I)
      const second = pair(I, child)

      assert.equal(left(first), child)
      assert.equal(right(second), child)
      assert.equal(left(first), right(second))
    })

    test('equal shape is not the same pair', () => {
      reset()
      const first = pair(I, I)
      const second = pair(I, I)

      assert.notEqual(first, second)
      assert.equal(left(first), left(second))
      assert.equal(right(first), right(second))
    })

    test('application is ordinary pair structure', () => {
      reset()
      const operator = pair()
      const operand = pair()
      const result = pair(operator, operand)

      assert.equal(left(result), operator)
      assert.equal(right(result), operand)
    })

    test('setters mutate slots and return the pair', () => {
      reset()
      const form = pair()
      const first = pair()
      const second = pair()

      assert.equal(setLeft(form, first), form)
      assert.equal(setRight(form, second), form)
      assert.equal(left(form), first)
      assert.equal(right(form), second)
    })
  })

  describe('passive collapse', () => {
    test('I observes to itself', () => {
      reset()

      assert.equal(observe(I), I)
    })

    test('collapse returns its next', () => {
      reset()
      const value = pair()
      const form = collapse(value)

      assert.equal(left(form), I)
      assert.equal(observe(form), value)
    })

    test('pair observes like its first child', () => {
      reset()
      const value = pair()
      const context = pair()
      const next = collapse(value)
      const form = pair(next, context)

      assert.equal(observe(form), observe(next))
      assert.equal(observe(form), value)
    })

    test('pair creation is explicit and observable', () => {
      reset()
      const before = size()
      const a = pair()
      const b = pair()
      const form = collapse(pair(a, b))
      const result = observe(form)

      assert.equal(size(), before + 4)
      assert.equal(left(result), a)
      assert.equal(right(result), b)
    })
  })

  describe('sharing', () => {
    test('share keeps one argument in both applications', () => {
      reset()
      const first = pair()
      const second = pair()
      const argument = pair()

      const result = share(first, second, argument)

      assert.equal(left(left(result)), first)
      assert.equal(right(left(result)), argument)
      assert.equal(left(right(result)), second)
      assert.equal(right(right(result)), argument)
      assert.equal(right(left(result)),
                   right(right(result)))
    })

    test('shared value stays shared after another observation', () => {
      reset()
      const first = pair()
      const second = pair()
      const argument = pair()

      const result = share(first, second, argument)
      const next = collapse(result)

      assert.equal(observe(next), result)
      assert.equal(right(left(result)),
                   right(right(result)))
    })
  })

  describe('fixed roots', () => {
    test('fix carries a payload without observing to the payload', () => {
      reset()
      const payload = pair()
      const root = fix(payload)

      assert.equal(observe(root), root)
      assert.equal(right(root), payload)
    })

    test('root carries current value', () => {
      reset()
      const root = collapse()
      const current = pair(root)
      setRight(root, current)

      assert.equal(observe(root), current)
      assert.equal(observe(current), current)
      assert.equal(right(root), current)
      assert.equal(left(current), root)
    })

    test('history observes through the current root', () => {
      reset()
      const root = collapse()
      const first = pair(root)
      const second = pair(root, first)
      const third = pair(root, second)
      setRight(root, third)

      assert.equal(observe(first), third)
      assert.equal(observe(second), third)
      assert.equal(observe(third), third)
      assert.equal(right(third), second)
      assert.equal(right(second), first)
    })

    test('the carried observer can be its own history', () => {
      reset()
      const root = collapse()
      const observer = pair(root, I)
      setRight(root, observer)
      setRight(observer, observer)

      assert.equal(observe(root), observer)
      assert.equal(observe(observer), observer)
      assert.equal(left(observer), root)
      assert.equal(right(observer), observer)
    })
  })
})
