import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { I, observe } from './observe.js'

describe('observe', () => {
  const observation = (observer, focus) =>
    [observer, focus]

  const identity = (observer, next = observer) =>
    [observer, next]

  const linkedFrame = (observer, focus, future = I) =>
    [observer, [focus, future]]

  const selectLinkedFrame = frame => {
    const [observer, carried] = frame
    const [focus, nextFrame] = carried
    const [first, next] = focus

    if (first === observer) return next

    return nextFrame
  }

  describe('basis contract', () => {
    test('I is a pair and the root graph', () => {
      const x = [I, I]

      assert.equal(I[0], I)
      assert.equal(I[1], I)
      assert.equal(I.length, 2)
      assert.notEqual(x, I)
    })

    test('I observes to itself', () => assert.equal(observe(observation(I, I)), I))

    test('the root can open to a loaded graph', () => {
      const graph = [I, I]
      const previous = I[1]

      graph[1] = graph
      I[1] = graph

      try {
        assert.equal(I[0], I)
        assert.equal(I[1], graph)
        assert.equal(observe(observation(I, I)), graph)
        assert.equal(observe(observation(I, graph)), graph)
      } finally {
        I[1] = previous
      }
    })

    test('collapse returns its next', () => {
      const x = [I, I]

      assert.equal(observe(observation(I, identity(I, x))), x)
    })

    test('pair observes like its first child', () => {
      const x = [I, I]
      const context = [I, I]
      const next = [I, x]
      const form = [next, context]

      assert.equal(observe(observation(I, form)), observe(observation(I, next)))
      assert.equal(observe(observation(I, form)), x)
    })

    test('observe takes one step rather than normalizing', () => {
      const value = [I, I]
      const inner = [I, value]
      const outer = [I, inner]

      assert.equal(observe(observation(I, outer)), inner)
      assert.notEqual(observe(observation(I, outer)), value)
      assert.equal(observe(observation(I, observe(observation(I, outer)))), value)
    })

    test('observation preserves sharing through different paths', () => {
      const value = [I, I]
      const shared = [I, value]
      const firstPath = [shared, [I, I]]
      const secondPath = [[shared, [I, I]], [I, I]]

      assert.equal(observe(observation(I, firstPath)), value)
      assert.equal(observe(observation(I, secondPath)), value)
      assert.equal(observe(observation(I, firstPath)), observe(observation(I, secondPath)))
    })

    test('a prelinked future is selected by identity', () => {
      const observer = [I, I]
      const value = [I, I]
      const focus = [[observer, value], I]
      const nextFrame = linkedFrame(observer, focus[0])
      const sameShape = linkedFrame(observer, focus[0])
      const frame = linkedFrame(observer, focus, nextFrame)
      const selected = selectLinkedFrame(frame)

      assert.equal(selected, nextFrame)
      assert.notEqual(selected, sameShape)
      assert.deepEqual(selected, sameShape)
    })

    test('a closed graph carries its own next observation', () => {
      const first = [I, I]
      const second = [I, I]
      first[0] = I
      first[1] = second
      second[0] = I
      second[1] = first

      assert.equal(observe(observation(I, first)), second)
      assert.equal(observe(observation(I, second)), first)
      assert.equal(observe(observation(I, observe(observation(I, first)))), first)
      assert.equal(observe(observation(I, observe(observation(I, second)))), second)
    })

    test('a closed orbit exposes a stable output port', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return [first, next]
      }
      const output = countedPair()
      const first = countedPair()
      const second = countedPair()
      first[0] = countedPair(I, second)
      first[1] = output
      second[0] = countedPair(I, first)
      second[1] = output
      const built = allocations

      const one = observe(observation(I, first))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))

      assert.equal(allocations, built)
      assert.equal(one, second)
      assert.equal(two, first)
      assert.equal(three, second)
      assert.equal(first[1], output)
      assert.equal(second[1], output)
      assert.equal(one[1], output)
      assert.equal(two[1], output)
    })

    test('succ reuses one cycle without allocating after construction', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return [first, next]
      }
      const root = countedPair()
      root[0] = I
      root[1] = countedPair(I, root)
      const built = allocations

      const one = observe(observation(I, root))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))
      const four = observe(observation(I, three))

      assert.equal(allocations, built)
      assert.equal(one, root[1])
      assert.equal(two, root)
      assert.equal(three, root[1])
      assert.equal(four, root)
    })
  })

})
