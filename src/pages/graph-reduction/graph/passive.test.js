import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  create,
  fixed,
  frame,
  linked,
  pair,
  read,
  step
} from './passive.js'

describe('passive frames', () => {
  test('an observer reads the first return to itself on the left path', () => {
    const observer = fixed()
    const value = fixed()
    const focus = pair(pair(pair(observer, value), fixed()), fixed())
    const path = []

    assert.equal(read(frame(observer, focus), node => path.push(node)), value)
    assert.deepEqual(path, [focus, focus[0], focus[0][0]])
  })

  test('the same focus can collapse or move depending on the observer', () => {
    const first = fixed()
    const second = fixed()
    const value = fixed()
    const focus = pair(first, value)
    const future = linked(second, first)

    assert.equal(step(linked(first, focus)), value)
    assert.equal(step(linked(second, focus, future)), future)
  })

  test('prelinked futures step without allocation', () => {
    let allocations = 0
    const counted = (left, right) => {
      allocations += 1
      return pair(left, right)
    }
    const countedFixed = () => {
      const node = counted(null, null)

      node[0] = node
      node[1] = node
      return node
    }
    const countedLinked = (observer, focus, future = observer) =>
      counted(observer, counted(focus, future))

    const observer = countedFixed()
    const firstFocus = counted(null, null)
    const secondFocus = counted(null, null)
    const firstFrame = countedLinked(observer, firstFocus)
    const secondFrame = countedLinked(observer, secondFocus, firstFrame)

    firstFocus[0] = secondFocus
    secondFocus[0] = firstFocus
    firstFrame[1][1] = secondFrame

    const built = allocations

    assert.equal(step(firstFrame), secondFrame)
    assert.equal(step(step(firstFrame)), firstFrame)
    assert.equal(step(step(step(firstFrame))), secondFrame)
    assert.equal(allocations, built)
  })

  test('an unlinked frame must create the next observer relation', () => {
    const observer = fixed()
    const value = fixed()
    const focus = pair(pair(observer, value), fixed())
    const created = create(frame(observer, focus))
    const sameShape = frame(observer, focus[0])

    assert.notEqual(created, sameShape)
    assert.deepEqual(created, sameShape)
    assert.equal(created[0], observer)
    assert.equal(created[1], focus[0])
  })
})
