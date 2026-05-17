import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { I, alloc, collapse, createHeap, fix, left, observe, pair, right,
         setLeft, setRight, share, size } from './core.js'

describe('pointer core', () => {
  describe('heap', () => {
    test('I is the root fixed point, not an allocated pair', () => {
      const heap = createHeap()

      assert.equal(I, 0)
      assert.equal(size(heap), 0)
      assert.equal(left(heap, I), I)
      assert.equal(right(heap, I), I)
    })

    test('allocation creates pointer identity', () => {
      const heap = createHeap()
      const a = alloc(heap)
      const b = alloc(heap)

      assert.notEqual(a, I)
      assert.notEqual(b, I)
      assert.notEqual(a, b)
      assert.equal(size(heap), 2)
    })

    test('shared child stays shared by pointer', () => {
      const heap = createHeap()
      const child = alloc(heap)
      const first = pair(heap, child, I)
      const second = pair(heap, I, child)

      assert.equal(left(heap, first), child)
      assert.equal(right(heap, second), child)
      assert.equal(left(heap, first), right(heap, second))
    })

    test('equal shape is not the same pair', () => {
      const heap = createHeap()
      const first = pair(heap, I, I)
      const second = pair(heap, I, I)

      assert.notEqual(first, second)
      assert.equal(left(heap, first), left(heap, second))
      assert.equal(right(heap, first), right(heap, second))
    })

    test('application is ordinary pair structure', () => {
      const heap = createHeap()
      const operator = alloc(heap)
      const operand = alloc(heap)
      const result = pair(heap, operator, operand)

      assert.equal(left(heap, result), operator)
      assert.equal(right(heap, result), operand)
    })

    test('setters mutate slots and return the pointer', () => {
      const heap = createHeap()
      const form = pair(heap)
      const first = alloc(heap)
      const second = alloc(heap)

      assert.equal(setLeft(heap, form, first), form)
      assert.equal(setRight(heap, form, second), form)
      assert.equal(left(heap, form), first)
      assert.equal(right(heap, form), second)
    })
  })

  describe('passive collapse', () => {
    test('I observes to itself', () => {
      const heap = createHeap()

      assert.equal(observe(heap, I), I)
    })

    test('collapse returns its next', () => {
      const heap = createHeap()
      const value = alloc(heap)
      const form = collapse(heap, value)

      assert.equal(left(heap, form), I)
      assert.equal(observe(heap, form), value)
    })

    test('pair observes like its first child', () => {
      const heap = createHeap()
      const value = alloc(heap)
      const context = alloc(heap)
      const next = collapse(heap, value)
      const form = pair(heap, next, context)

      assert.equal(observe(heap, form), observe(heap, next))
      assert.equal(observe(heap, form), value)
    })

    test('pair creation is explicit and observable', () => {
      const heap = createHeap()
      const before = size(heap)
      const a = alloc(heap)
      const b = alloc(heap)
      const form = collapse(heap, pair(heap, a, b))
      const result = observe(heap, form)

      assert.equal(size(heap), before + 4)
      assert.equal(left(heap, result), a)
      assert.equal(right(heap, result), b)
    })
  })

  describe('sharing', () => {
    test('share keeps one argument in both applications', () => {
      const heap = createHeap()
      const first = alloc(heap)
      const second = alloc(heap)
      const argument = alloc(heap)

      const result = share(heap, first, second, argument)

      assert.equal(left(heap, left(heap, result)), first)
      assert.equal(right(heap, left(heap, result)), argument)
      assert.equal(left(heap, right(heap, result)), second)
      assert.equal(right(heap, right(heap, result)), argument)
      assert.equal(right(heap, left(heap, result)),
                   right(heap, right(heap, result)))
    })

    test('shared value stays shared after another observation', () => {
      const heap = createHeap()
      const first = alloc(heap)
      const second = alloc(heap)
      const argument = alloc(heap)

      const result = share(heap, first, second, argument)
      const next = collapse(heap, result)

      assert.equal(observe(heap, next), result)
      assert.equal(right(heap, left(heap, result)),
                   right(heap, right(heap, result)))
    })
  })

  describe('fixed roots', () => {
    test('fix carries a payload without observing to the payload', () => {
      const heap = createHeap()
      const payload = alloc(heap)
      const root = fix(heap, payload)

      assert.equal(observe(heap, root), root)
      assert.equal(right(heap, root), payload)
    })

    test('root carries current value', () => {
      const heap = createHeap()
      const root = collapse(heap)
      const current = pair(heap, root)
      setRight(heap, root, current)

      assert.equal(observe(heap, root), current)
      assert.equal(observe(heap, current), current)
      assert.equal(right(heap, root), current)
      assert.equal(left(heap, current), root)
    })

    test('history observes through the current root', () => {
      const heap = createHeap()
      const root = collapse(heap)
      const first = pair(heap, root)
      const second = pair(heap, root, first)
      const third = pair(heap, root, second)
      setRight(heap, root, third)

      assert.equal(observe(heap, first), third)
      assert.equal(observe(heap, second), third)
      assert.equal(observe(heap, third), third)
      assert.equal(right(heap, third), second)
      assert.equal(right(heap, second), first)
    })

    test('the carried observer can be its own history', () => {
      const heap = createHeap()
      const root = collapse(heap)
      const observer = pair(heap, root, I)
      setRight(heap, root, observer)
      setRight(heap, observer, observer)

      assert.equal(observe(heap, root), observer)
      assert.equal(observe(heap, observer), observer)
      assert.equal(left(heap, observer), root)
      assert.equal(right(heap, observer), observer)
    })
  })
})
