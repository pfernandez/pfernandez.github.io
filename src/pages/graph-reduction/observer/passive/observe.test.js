import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { I, observe, pair } from './observe.js'

describe('observe', () => {
  const fix = (next = I) => {
    const root = pair()
    root[0] = pair(I, root)
    root[1] = next
    return root
  }

  const share = (first, second, argument) =>
    pair(pair(first, argument), pair(second, argument))

  const observeWhen = (isStable, focus, limit = 16) => {
    let current = focus

    for (let step = 0; step < limit; step += 1) {
      const [first, next] = current

      if (isStable(first, current)) return next

      current = first
    }
  }

  const selfCollapse = next => {
    const focus = pair()
    focus[0] = focus
    focus[1] = next
    return focus
  }

  const createFrameStep = frame => {
    const [observer, focus] = frame
    const [first, next] = focus

    if (first === observer) return next

    return pair(observer, first)
  }

  const linkedFrame = (observer, focus, future = I) =>
    pair(observer, pair(focus, future))

  const selectLinkedFrame = frame => {
    const [observer, carried] = frame
    const [focus, nextFrame] = carried
    const [first, next] = focus

    if (first === observer) return next

    return nextFrame
  }

  describe('core equivalence', () => {
    test('I is a pair and the root graph', () => {
      const x = pair()

      assert.equal(I[0], I)
      assert.equal(I[1], I)
      assert.equal(I.length, 2)
      assert.notEqual(x, I)
    })

    test('I observes to itself', () => assert.equal(observe(I), I))

    test('the root can open to a loaded graph', () => {
      const graph = pair()
      const previous = I[1]

      graph[1] = graph
      I[1] = graph

      try {
        assert.equal(I[0], I)
        assert.equal(I[1], graph)
        assert.equal(observe(I), graph)
        assert.equal(observe(graph), graph)
      } finally {
        I[1] = previous
      }
    })

    test('collapse returns its next', () => {
      const x = pair()

      assert.equal(observe(pair(I, x)), x)
    })

    test('pair observes like its first child', () => {
      const x = pair()
      const context = pair()
      const next = pair(I, x)
      const form = pair(next, context)

      assert.equal(observe(form), observe(next))
      assert.equal(observe(form), x)
    })
  })

  describe('collapse predicates', () => {
    test('root collapse reads a root-left wrapper', () => {
      const value = pair()
      const wrapper = pair(I, value)

      assert.equal(observeWhen(first => first === I, wrapper), value)
    })

    test('local collapse reads a self-left wrapper', () => {
      const value = pair()
      const wrapper = selfCollapse(value)

      assert.equal(
        observeWhen((first, focus) => first === focus, wrapper),
        value
      )
    })

    test('the predicates choose different wrappers', () => {
      const value = pair()
      const rootWrapper = pair(I, value)
      const selfWrapper = selfCollapse(value)

      assert.equal(observeWhen(first => first === I, rootWrapper), value)
      assert.equal(
        observeWhen((first, focus) => first === focus, rootWrapper),
        I
      )
      assert.equal(
        observeWhen((first, focus) => first === focus, selfWrapper),
        value
      )
      assert.equal(observeWhen(first => first === I, selfWrapper), undefined)
    })
  })

  describe('linked futures', () => {
    test('a root frame collapses like passive observe', () => {
      const value = pair()
      const focus = pair(I, value)
      const frame = linkedFrame(I, focus)

      assert.equal(selectLinkedFrame(frame), value)
      assert.equal(selectLinkedFrame(frame), observe(focus))
    })

    test('a frame selects its carried future while moving focus left', () => {
      const observer = pair()
      const value = pair()
      const focus = pair(pair(observer, value), pair())
      const nextFrame = linkedFrame(observer, focus[0])
      const frame = linkedFrame(observer, focus, nextFrame)

      assert.equal(selectLinkedFrame(frame), nextFrame)
      assert.equal(selectLinkedFrame(nextFrame), value)
    })

    test('the same focus can collapse for one observer and move for another', () => {
      const firstObserver = pair()
      const secondObserver = pair()
      const value = pair()
      const focus = pair(firstObserver, value)
      const future = linkedFrame(secondObserver, firstObserver)
      const firstFrame = linkedFrame(firstObserver, focus)
      const secondFrame = linkedFrame(secondObserver, focus, future)

      assert.equal(selectLinkedFrame(firstFrame), value)
      assert.equal(selectLinkedFrame(secondFrame), future)
      assert.equal(future[0], secondObserver)
      assert.equal(future[1][0], firstObserver)
    })

    test('a constrained future chain reaches a deterministic result', () => {
      const observer = pair()
      const result = pair()
      const finalFocus = pair(observer, result)
      const finalFrame = linkedFrame(observer, finalFocus)
      const initialFocus = pair(finalFocus, pair())
      const initialFrame = linkedFrame(observer, initialFocus, finalFrame)

      assert.equal(selectLinkedFrame(initialFrame), finalFrame)
      assert.equal(selectLinkedFrame(finalFrame), result)
    })

    test('a cyclic future chain reuses frames while unfolding depth', () => {
      const observer = pair()
      const firstFocus = pair()
      const secondFocus = pair()
      const firstFrame = linkedFrame(observer, firstFocus)
      const secondFrame = linkedFrame(observer, secondFocus, firstFrame)
      firstFocus[0] = secondFocus
      secondFocus[0] = firstFocus
      firstFrame[1][1] = secondFrame

      const one = selectLinkedFrame(firstFrame)
      const two = selectLinkedFrame(one)
      const three = selectLinkedFrame(two)

      assert.equal(secondFrame[1][0], firstFocus[0])
      assert.equal(firstFrame[1][0], secondFocus[0])
      assert.equal(one, secondFrame)
      assert.equal(two, firstFrame)
      assert.equal(three, secondFrame)
      assert.deepEqual(
        one,
        linkedFrame(observer, secondFocus, linkedFrame(
          observer,
          firstFocus,
          secondFrame
        ))
      )
    })
  })

  describe('unlinked frames', () => {
    test('an unlinked frame has to create the next relation', () => {
      const observer = pair()
      const value = pair()
      const focus = pair(pair(observer, value), pair())
      const frame = pair(observer, focus)
      const existing = pair(observer, focus[0])
      const created = createFrameStep(frame)

      assert.notEqual(created, existing)
      assert.equal(created[0], existing[0])
      assert.equal(created[1], existing[1])
    })
  })

  describe('observer as data', () => {
    test('an observation frame observes like its focus', () => {
      const x = pair()
      const y = pair()
      const target = pair(pair(I, x), y)
      const frame = pair(target, I)

      assert.equal(observe(frame), observe(target))
      assert.equal(observe(frame), x)
      assert.equal(frame[0], target)
      assert.equal(frame[1], I)
    })

    test('a data observer can carry the current focus', () => {
      const observer = pair()
      const x = pair()
      const y = pair()
      const first = pair(I, x)
      const second = pair(pair(I, y), pair())

      observer[0] = first
      observer[1] = I
      assert.equal(observe(observer), x)

      observer[0] = second
      assert.equal(observe(observer), y)
      assert.equal(observer[1], I)
    })

    test('a fixed first-position function cannot inspect its next', () => {
      const x = pair()
      const y = pair()
      const fixed = pair(pair(I, x), pair())

      assert.equal(observe(pair(fixed, x)), observe(fixed))
      assert.equal(observe(pair(fixed, y)), observe(fixed))
      assert.equal(observe(pair(I, x)), x)
      assert.equal(observe(pair(I, y)), y)
    })

    test('a fixed collapse observes to itself instead of consuming next', () => {
      const fixedI = pair()
      const x = pair()
      fixedI[0] = I
      fixedI[1] = fixedI

      assert.equal(observe(fixedI), fixedI)
      assert.equal(observe(pair(fixedI, x)), fixedI)
      assert.notEqual(observe(pair(fixedI, x)), x)
    })

    test('root exposes the next frame from carried possibility', () => {
      const root = pair()
      const currentValue = pair()
      const nextValue = pair()
      const current = pair(pair(I, currentValue), I)
      const next = pair(pair(I, nextValue), I)
      const carried = pair(current, next)

      root[0] = pair(I, carried[1])
      root[1] = carried

      assert.equal(root[1][0], current)
      assert.equal(root[1][1], next)
      assert.equal(observe(root), next)
      assert.equal(observe(observe(root)), nextValue)
      assert.equal(observe(current), currentValue)
    })
  })

  describe('slot rewrites', () => {
    test('a collapse slot can be rewritten from context', () => {
      const left = pair()
      const right = pair()
      const form = pair(pair(I, left), right)
      const oldValue = form[0][1]

      form[0][0] = I
      form[0][1] = form[1]

      assert.equal(oldValue, left)
      assert.equal(form[0][1], right)
      assert.equal(observe(form), right)
    })

    test('a pair can be assembled from carried slots', () => {
      const left = pair()
      const right = pair()
      const result = pair()
      const form = pair(pair(pair(I, result), left), right)

      result[0] = form[0][1]
      result[1] = form[1]

      assert.equal(observe(form), result)
      assert.deepEqual(result, [left, right])
      assert.equal(result[0], left)
      assert.equal(result[1], right)
    })
  })

  describe('sharing', () => {
    test('share can replace the collapsed value from current slots', () => {
      const x = pair()
      const y = pair()
      const z = pair()
      const form = pair(pair(pair(I, x), y), z)
      const oldValue = form[0][0][1]
      const result = share(form[0][0][1], form[0][1], form[1])

      form[0][0][0] = I
      form[0][0][1] = result

      assert.equal(oldValue, x)
      assert.equal(form[0][0][1], result)
      assert.deepEqual(observe(form), share(x, y, z))
      assert.equal(result[0][0], oldValue)
      assert.equal(result[0][1], z)
      assert.equal(result[1][0], y)
      assert.equal(result[1][1], z)
      assert.equal(result[0][1], result[1][1])
    })

    test('share can also be installed as a left wrapper', () => {
      const x = pair()
      const y = pair()
      const z = pair()
      const form = pair(pair(pair(I, x), y), z)
      const oldValue = form[0][0][1]
      const result = share(form[0][0][1], form[0][1], form[1])

      form[0][0][0] = pair(I, result)

      assert.equal(form[0][0][1], oldValue)
      assert.equal(observe(form), result)
      assert.deepEqual(result, share(x, y, z))
      assert.equal(result[0][1], result[1][1])
    })

    test('shared value stays shared after another observation', () => {
      const x = pair()
      const y = pair()
      const z = pair()
      const result = share(x, y, z)
      const next = pair(I, result)

      assert.equal(observe(next), result)
      assert.equal(result[0][1], result[1][1])
    })

    test('result can carry a root forward', () => {
      const root = pair()
      const a = pair()
      const b = pair()
      const form = pair(pair(pair(I, a), b), root)
      const result = share(a, b, root)
      form[0][0][1] = result
      root[0] = I
      root[1] = form

      assert.deepEqual(observe(form), share(a, b, root))
      assert.equal(result[0][1], root)
      assert.equal(result[1][1], root)
      assert.equal(result[0][1], result[1][1])
      assert.equal(observe(root), form)
    })
  })

  describe('selectors', () => {
    test('left and right are collapse reads of pair slots', () => {
      const left = pair()
      const right = pair()
      const subject = pair(left, right)

      assert.equal(observe(pair(I, subject[0])), left)
      assert.equal(observe(pair(I, subject[1])), right)
    })
  })

  describe('depth', () => {
    test('succ', () => {
      const root = pair()
      root[0] = I
      root[1] = pair(I, root)

      const one = observe(root)
      const two = observe(one)
      const three = observe(two)

      assert.deepEqual(one, pair(I, root))
      assert.deepEqual(two, pair(I, pair(I, root)))
      assert.deepEqual(three, pair(I, pair(I, pair(I, root))))
    })

    test('depths share one fixed point', () => {
      const root = pair()
      root[0] = I
      root[1] = pair(I, root)

      const one = observe(root)
      const two = observe(one)
      const three = observe(two)

      assert.equal(two, root)
      assert.equal(three, one)
      assert.deepEqual(one, two)
      assert.deepEqual(two, three)
    })

    test('finite depths keep distinct identity', () => {
      const zero = I
      const one = pair(I, zero)
      const two = pair(I, one)
      const three = pair(I, two)

      assert.notEqual(zero, one)
      assert.notEqual(one, two)
      assert.notEqual(two, three)
      assert.equal(observe(one), zero)
      assert.equal(observe(two), one)
      assert.equal(observe(three), two)
    })
  })

  describe('fixed roots', () => {
    test('root evaluates to itself through its own collapse', () => {
      const root = fix()

      assert.equal(observe(root), root)
      assert.equal(observe(observe(root)), root)
      assert.equal(root[0][0], I)
      assert.equal(root[0][1], root)
    })

    test('fixed root observes to itself while carrying a payload', () => {
      const left = pair()
      const right = pair()
      const payload = pair(left, right)
      const root = fix(payload)

      assert.equal(observe(root), root)
      assert.equal(root[1], payload)
      assert.equal(payload[0], left)
      assert.equal(payload[1], right)
    })

    test('root carries current value', () => {
      const root = pair()
      const current = pair(root)
      root[0] = I
      root[1] = current

      assert.equal(observe(root), current)
      assert.equal(observe(current), current)
      assert.equal(root[1], current)
      assert.equal(current[0], root)
    })

    test('history observes through the current root', () => {
      const root = pair()
      const first = pair(root)
      const second = pair(root, first)
      const third = pair(root, second)
      root[0] = I
      root[1] = third

      assert.equal(observe(first), third)
      assert.equal(observe(second), third)
      assert.equal(observe(third), third)
      assert.equal(third[1], second)
      assert.equal(second[1], first)
    })

    test('observer can carry itself as history', () => {
      const root = pair()
      const observer = pair()
      root[0] = I
      root[1] = observer
      observer[0] = root
      observer[1] = observer

      assert.equal(observe(root), observer)
      assert.equal(observe(observer), observer)
      assert.equal(observer[0], root)
      assert.equal(observer[1], observer)
    })
  })
})
