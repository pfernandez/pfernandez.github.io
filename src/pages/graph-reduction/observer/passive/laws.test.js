import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

describe('machine laws', () => {
  const fixedRoot = () => {
    const I = []
    I[0] = I
    I[1] = I

    return I
  }

  test('observe returns an existing reachable value', () => {
    const I = fixedRoot()
    const value = [I, I]
    const future = [I, value]
    const focus = [future, [I, I]]

    const selected = observe([I, focus])

    assert.equal(selected, value)
    assert.equal(selected, future[1])
  })

  test('observe does not rewrite what it reads', () => {
    const I = fixedRoot()
    const value = [I, I]
    const future = [I, value]
    const context = [I, I]
    const focus = [future, context]
    const frame = [I, focus]

    const selected = observe(frame)

    assert.equal(selected, value)
    assert.equal(frame[0], I)
    assert.equal(frame[1], focus)
    assert.equal(focus[0], future)
    assert.equal(focus[1], context)
    assert.equal(future[0], I)
    assert.equal(future[1], value)
  })

  test('observation does not create pairs', () => {
    const I = fixedRoot()
    let pairs = 0
    const countedPair = (first = I, next = I) => {
      pairs += 1
      return [first, next]
    }
    const value = countedPair()
    const future = countedPair(I, value)
    const focus = countedPair(future, countedPair())
    const frame = countedPair(I, focus)
    const built = pairs

    assert.equal(observe(frame), value)
    assert.equal(pairs, built)
  })

  test('a cycle projects unbounded path depth', () => {
    const I = fixedRoot()
    let pairs = 0
    const countedPair = (first = I, next = I) => {
      pairs += 1
      return [first, next]
    }
    const root = countedPair()
    const next = countedPair(I, root)
    root[0] = I
    root[1] = next
    const built = pairs

    assert.equal(root[0], I)
    assert.equal(root[1][0], I)
    assert.equal(root[1][1][0], I)
    assert.equal(root[1][1][1][0], I)
    assert.equal(root[1][1][1][1][0], I)
    assert.equal(root[1][1][1][1][1][0], I)
    assert.equal(observe([I, root]), next)
    assert.equal(observe([I, next]), root)
    assert.equal(pairs, built)
  })

  test('a cycle can return the next observation frame', () => {
    const I = fixedRoot()
    let pairs = 0
    const countedPair = (first = I, next = I) => {
      pairs += 1
      return [first, next]
    }
    const firstFrame = countedPair(I, I)
    const secondFrame = countedPair(I, I)
    const firstFocus = countedPair(I, secondFrame)
    const secondFocus = countedPair(I, firstFrame)
    firstFrame[1] = firstFocus
    secondFrame[1] = secondFocus
    const built = pairs

    const one = observe(firstFrame)
    const two = observe(one)
    const three = observe(two)
    const four = observe(three)

    assert.equal(pairs, built)
    assert.equal(one, secondFrame)
    assert.equal(two, firstFrame)
    assert.equal(three, secondFrame)
    assert.equal(four, firstFrame)
  })

  test('a finite passive path returns to its root', () => {
    const I = fixedRoot()
    const firstFrame = [I, I]
    const secondFrame = [I, I]
    const thirdFrame = [I, I]
    firstFrame[1] = [I, secondFrame]
    secondFrame[1] = [I, thirdFrame]
    thirdFrame[1] = [I, firstFrame]

    const one = observe(firstFrame)
    const two = observe(one)
    const three = observe(two)
    const four = observe(three)

    assert.notEqual(one, two)
    assert.notEqual(two, three)
    assert.equal(one, four)
  })

  test('right branches are carried, not consumed', () => {
    const I = fixedRoot()
    const selected = [I, I]
    const carried = [I, I]
    const focus = [[I, selected], [I, carried]]

    const result = observe([I, focus])

    assert.equal(result, selected)
    assert.notEqual(result, carried)
    assert.equal(focus[1][1], carried)
  })

  test('crossing preserves a shared cause', () => {
    const I = fixedRoot()
    const cause = [I, I]
    const left = [I, cause]
    const right = [I, cause]
    const crossing = [left, right]

    assert.equal(crossing[0][1], cause)
    assert.equal(crossing[1][1], cause)
    assert.equal(crossing[0][1], crossing[1][1])
    assert.equal(observe([I, [I, crossing]]), crossing)
  })

  test('a fixed point resolves through its observer', () => {
    const I = fixedRoot()
    const root = [I, I]
    const value = [I, I]
    root[0] = root
    root[1] = value

    assert.equal(observe([root, root]), value)
  })

  test('a closed cycle runs without new pairs', () => {
    const I = fixedRoot()
    let pairs = 0
    const countedPair = (first = I, next = I) => {
      pairs += 1
      return [first, next]
    }
    const first = countedPair()
    const second = countedPair()
    first[0] = countedPair(I, second)
    first[1] = first
    second[0] = countedPair(I, first)
    second[1] = second
    const built = pairs

    const afterFirst = observe([I, first])
    const afterSecond = observe([I, afterFirst])
    const afterThird = observe([I, afterSecond])

    assert.equal(pairs, built)
    assert.equal(afterFirst, second)
    assert.equal(afterSecond, first)
    assert.equal(afterThird, second)
  })
})
