import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createBasis } from './basis.js'
import { EMPTY, alloc, createHeap, left, observe, right, setLeft, setRight,
         size } from './core.js'

const pair = (heap, leftValue = EMPTY, rightValue = EMPTY) =>
  alloc(heap, leftValue, rightValue)

const createPointerBasis = heap => createBasis({
  empty: EMPTY,
  pair: (leftValue = EMPTY, rightValue = EMPTY) =>
    pair(heap, leftValue, rightValue),
  setLeft: (pointer, value) => setLeft(heap, pointer, value),
  setRight: (pointer, value) => setRight(heap, pointer, value)
})

describe('pointer core', () => {
  describe('heap', () => {
    test('empty is the empty pointer, not an allocated pair', () => {
      const heap = createHeap()

      assert.equal(EMPTY, 0)
      assert.equal(size(heap), 0)
      assert.equal(left(heap, EMPTY), EMPTY)
      assert.equal(right(heap, EMPTY), EMPTY)
    })

    test('allocation creates pointer identity', () => {
      const heap = createHeap()
      const a = alloc(heap)
      const b = alloc(heap)

      assert.notEqual(a, EMPTY)
      assert.notEqual(b, EMPTY)
      assert.notEqual(a, b)
      assert.equal(size(heap), 2)
    })

    test('shared child stays shared by pointer', () => {
      const heap = createHeap()
      const child = alloc(heap)
      const first = pair(heap, child, EMPTY)
      const second = pair(heap, EMPTY, child)

      assert.equal(left(heap, first), child)
      assert.equal(right(heap, second), child)
      assert.equal(left(heap, first), right(heap, second))
    })

    test('equal shape is not the same pair', () => {
      const heap = createHeap()
      const first = pair(heap, EMPTY, EMPTY)
      const second = pair(heap, EMPTY, EMPTY)

      assert.notEqual(first, second)
      assert.equal(left(heap, first), left(heap, second))
      assert.equal(right(heap, first), right(heap, second))
    })

    test('application is ordinary pair structure', () => {
      const heap = createHeap()
      const { application } = createPointerBasis(heap)
      const operator = alloc(heap)
      const operand = alloc(heap)
      const result = application(operator, operand)

      assert.equal(left(heap, result), operator)
      assert.equal(right(heap, result), operand)
    })
  })

  describe('passive collapse', () => {
    test('empty observes to empty', () => {
      const heap = createHeap()

      assert.equal(observe(heap, EMPTY), EMPTY)
    })

    test('stable pair returns its right child', () => {
      const heap = createHeap()
      const { stable } = createPointerBasis(heap)
      const value = alloc(heap)
      const form = stable(value)

      assert.equal(left(heap, form), EMPTY)
      assert.equal(observe(heap, form), value)
    })

    test('I returns value', () => {
      const heap = createHeap()
      const { I } = createPointerBasis(heap)
      const value = alloc(heap)

      assert.equal(observe(heap, I(value)), value)
    })

    test('keep returns left', () => {
      const heap = createHeap()
      const { keep } = createPointerBasis(heap)
      const kept = alloc(heap)
      const ignored = alloc(heap)

      assert.equal(observe(heap, keep(kept, ignored)), kept)
    })

    test('right choice returns right', () => {
      const heap = createHeap()
      const { chooseRight } = createPointerBasis(heap)
      const ignored = alloc(heap)
      const kept = alloc(heap)

      assert.equal(observe(heap, chooseRight(ignored, kept)), kept)
    })

    test('pair creation is explicit and observable', () => {
      const heap = createHeap()
      const { exposePair } = createPointerBasis(heap)
      const before = size(heap)
      const a = alloc(heap)
      const b = alloc(heap)
      const form = exposePair(a, b)
      const result = observe(heap, form)

      assert.equal(size(heap), before + 4)
      assert.equal(left(heap, result), a)
      assert.equal(right(heap, result), b)
    })
  })

  describe('sharing', () => {
    test('share keeps one argument in both applications', () => {
      const heap = createHeap()
      const { share } = createPointerBasis(heap)
      const first = alloc(heap)
      const second = alloc(heap)
      const argument = alloc(heap)

      const result = observe(heap, share(first, second, argument))

      assert.equal(left(heap, left(heap, result)), first)
      assert.equal(right(heap, left(heap, result)), argument)
      assert.equal(left(heap, right(heap, result)), second)
      assert.equal(right(heap, right(heap, result)), argument)
      assert.equal(right(heap, left(heap, result)),
                   right(heap, right(heap, result)))
    })

    test('shared value stays shared after another observation', () => {
      const heap = createHeap()
      const { share, stable } = createPointerBasis(heap)
      const first = alloc(heap)
      const second = alloc(heap)
      const argument = alloc(heap)

      const result = observe(heap, share(first, second, argument))
      const next = stable(result)

      assert.equal(observe(heap, next), result)
      assert.equal(right(heap, left(heap, result)),
                   right(heap, right(heap, result)))
    })
  })

  describe('fixed roots', () => {
    test('fix carries a payload without observing to the payload', () => {
      const heap = createHeap()
      const { fix } = createPointerBasis(heap)
      const payload = alloc(heap)
      const root = fix(payload)

      assert.equal(observe(heap, root), root)
      assert.equal(right(heap, left(heap, root)), payload)
    })

    test('root carries current value', () => {
      const heap = createHeap()
      const { carry, createRoot, setCurrent } = createPointerBasis(heap)
      const root = createRoot()
      const current = carry(root)
      setCurrent(root, current)

      assert.equal(observe(heap, root), current)
      assert.equal(observe(heap, current), current)
      assert.equal(right(heap, root), current)
      assert.equal(left(heap, current), root)
    })

    test('history observes through the current root', () => {
      const heap = createHeap()
      const { carry, createRoot, setCurrent } = createPointerBasis(heap)
      const root = createRoot()
      const first = carry(root)
      const second = carry(root, first)
      const third = carry(root, second)
      setCurrent(root, third)

      assert.equal(observe(heap, first), third)
      assert.equal(observe(heap, second), third)
      assert.equal(observe(heap, third), third)
      assert.equal(right(heap, third), second)
      assert.equal(right(heap, second), first)
    })

    test('the carried observer can be its own history', () => {
      const heap = createHeap()
      const { createRoot, setCurrent } = createPointerBasis(heap)
      const root = createRoot()
      const observer = pair(heap, root, EMPTY)
      setCurrent(root, observer)
      setRight(heap, observer, observer)

      assert.equal(observe(heap, root), observer)
      assert.equal(observe(heap, observer), observer)
      assert.equal(left(heap, observer), root)
      assert.equal(right(heap, observer), observer)
    })
  })
})
