import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { I, observe, pair } from './observe.js'

describe('observe', () => {
  const collapse = next => pair(I, next)

  const fix = (next = I) => {
    const root = pair()
    root[0] = collapse(root)
    root[1] = next
    return root
  }

  const observation = focus => pair(focus, I)

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

      assert.equal(observe(collapse(x)), x)
    })

    test('pair observes like its first child', () => {
      const x = pair()
      const context = pair()
      const next = collapse(x)
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

  describe('observer as data', () => {
    test('an observation frame observes like its focus', () => {
      const x = pair()
      const y = pair()
      const target = pair(collapse(x), y)
      const frame = observation(target)

      assert.equal(observe(frame), observe(target))
      assert.equal(observe(frame), x)
      assert.equal(frame[0], target)
      assert.equal(frame[1], I)
    })

    test('a data observer can carry the current focus', () => {
      const observer = pair()
      const x = pair()
      const y = pair()
      const first = collapse(x)
      const second = pair(collapse(y), pair())

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
      const fixed = pair(collapse(x), pair())

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
      const current = observation(collapse(currentValue))
      const next = observation(collapse(nextValue))
      const carried = pair(current, next)

      root[0] = collapse(carried[1])
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
      const form = pair(collapse(left), right)
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
      const form = pair(pair(collapse(result), left), right)

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
      const form = pair(pair(collapse(x), y), z)
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
      const form = pair(pair(collapse(x), y), z)
      const oldValue = form[0][0][1]
      const result = share(form[0][0][1], form[0][1], form[1])

      form[0][0][0] = collapse(result)

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
      const next = collapse(result)

      assert.equal(observe(next), result)
      assert.equal(result[0][1], result[1][1])
    })

    test('result can carry a root forward', () => {
      const root = pair()
      const a = pair()
      const b = pair()
      const form = pair(pair(collapse(a), b), root)
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

      assert.equal(observe(collapse(subject[0])), left)
      assert.equal(observe(collapse(subject[1])), right)
    })
  })

  describe('depth', () => {
    test('succ', () => {
      const root = pair()
      root[0] = I
      root[1] = collapse(root)

      const one = observe(root)
      const two = observe(one)
      const three = observe(two)

      assert.deepEqual(one, collapse(root))
      assert.deepEqual(two, collapse(collapse(root)))
      assert.deepEqual(three, collapse(collapse(collapse(root))))
    })

    test('depths share one fixed point', () => {
      const root = pair()
      root[0] = I
      root[1] = collapse(root)

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
      const one = collapse(zero)
      const two = collapse(one)
      const three = collapse(two)

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
