import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

describe('observe', () => {
  describe('core', () => {
    test('empty', () => assert.deepEqual(observe([]), []))

    test('empty left returns right', () => {
      assert.deepEqual(observe([[], []]), [])
      assert.deepEqual(observe([[], [[], []]]), [[], []])
    })

    test('I returns value', () => {
      const x = [[], []]
      assert.equal(observe([[], x]), x)
    })

    test('keep returns left', () => {
      const left = [[], []]
      const right = [[], []]
      const keep = [[[], left], right]

      assert.equal(observe(keep), left)
    })
  })

  describe('left and right', () => {
    test('left path returns left value', () => {
      const x = [[], []]
      const y = [[], []]
      assert.equal(observe([[[], x], y]), x)
    })

    test('rewired left path returns right value', () => {
      const x = [[], []]
      const y = [[], []]
      const $ = [[[], x], y]
      $[0][0][0] = []
      $[0][0][1] = $[1]

      assert.equal(observe($), y)
    })

    test('pair exposes left and right', () => {
      const x = [[], []]
      const y = [[], []]
      const $ = [[[[], []], x], y]

      $[0][0][1][0] = $[0][1]
      $[0][0][1][1] = $[1]

      const result = observe($)
      assert.deepEqual(result, [x, y])
      assert.equal(result, $[0][0][1])
      assert.equal(result[0], x)
      assert.equal(result[1], y)
    })
  })

  describe('sharing', () => {
    test('share', () => {
      const x = [[], []]
      const y = [[], []]
      const z = [[], []]
      const $ = [[[[], x], y], z]
      $[0][0][0] = [[], [[$[0][0][1], $[1]], [$[0][1], $[1]]]]

      const result = observe($)
      assert.deepEqual(result, [[x, z], [y, z]])
      assert.equal(result[0][1], z)
      assert.equal(result[1][1], z)
      assert.equal(result[0][1], result[1][1])
    })

    test('keeps the same argument in both applications', () => {
      const a = [[], []]
      const b = [[], []]
      const c = [[], []]
      const $ = [[[[], a], b], c]
      $[0][0][0] = [[], [[a, c], [b, c]]]

      const result = observe($)
      assert.deepEqual(result, [[a, c], [b, c]])
      assert.equal(result[0][1], c)
      assert.equal(result[1][1], c)
      assert.equal(result[0][1], result[1][1])
    })

    test('shared value stays shared after another observation', () => {
      const a = [[], []]
      const b = [[], []]
      const c = [[], []]
      const $ = [[[[], a], b], c]
      $[0][0][0] = [[], [[a, c], [b, c]]]

      const result = observe($)
      const next = [[], result]

      assert.equal(observe(next), result)
      assert.equal(result[0][1], result[1][1])
    })

    test('result carries root forward', () => {
      const root = []
      const a = [[], []]
      const b = [[], []]
      const $ = [[[[], a], b], root]
      $[0][0][0] = [[], [[a, root], [b, root]]]
      root[0] = []
      root[1] = $

      const result = observe($)
      assert.deepEqual(result, [[a, root], [b, root]])
      assert.equal(result[0][1], root)
      assert.equal(result[1][1], root)
      assert.equal(result[0][1], result[1][1])
      assert.equal(observe(root), $)
    })
  })

  describe('choice wiring', () => {
    test('left reads left', () => {
      const left = [[], []]
      const right = [[], []]
      const choice = [[[], left], right]

      assert.equal(observe(choice), left)
    })

    test('right reads right', () => {
      const left = [[], []]
      const right = [[], []]
      const choice = [[[], left], right]

      choice[0][0][0] = []
      choice[0][0][1] = choice[1]

      assert.equal(observe(choice), right)
    })
  })

  describe('depth', () => {
    test('succ', () => {
      const $ = []
      $[0] = []
      $[1] = [[], $]

      const one = observe($)
      const two = observe(one)
      const three = observe(two)

      assert.deepEqual(one, [[], $])
      assert.deepEqual(two, [[], [[], $]])
      assert.deepEqual(three, [[], [[], [[], $]]])
    })

    test('depths share one fixed point', () => {
      const $ = []
      $[0] = []
      $[1] = [[], $]

      const one = observe($)
      const two = observe(one)
      const three = observe(two)

      assert.equal(two, $)
      assert.equal(three, one)
      assert.deepEqual(one, two)
      assert.deepEqual(two, three)
    })

    test('finite depths stay distinct', () => {
      const zero = []
      const one = [[], zero]
      const two = [[], one]
      const three = [[], two]

      assert.notDeepEqual(zero, one)
      assert.notDeepEqual(one, two)
      assert.notDeepEqual(two, three)
    })
  })

  describe('core pairs', () => {
    test('fix carries a pair', () => {
      const left = [[], []]
      const right = [[], []]
      const pair = [left, right]
      const $ = []
      $[0] = [[[], $], pair]

      assert.equal(observe($), $)
      assert.equal($[0][1], pair)
      assert.equal(pair[0], left)
      assert.equal(pair[1], right)
    })

    test('left reads left', () => {
      const left = [[], []]
      const right = [[], []]
      const pair = [left, right]
      const leftSelector = [[[], pair[0]], pair[1]]

      assert.equal(observe(leftSelector), left)
    })

    test('right reads right', () => {
      const left = [[], []]
      const right = [[], []]
      const pair = [left, right]
      const rightSelector = [[[], pair[0]], pair[1]]

      rightSelector[0][0][0] = []
      rightSelector[0][0][1] = pair[1]

      assert.equal(observe(rightSelector), right)
    })

    test('fix carries a payload', () => {
      const $ = []
      const payload = [[], []]
      $[0] = [[[], $], payload]

      assert.equal(observe($), $)
      assert.equal($[0][1], payload)
    })
  })

  describe('carried observer', () => {
    test('fix can carry an observer', () => {
      const system = []
      const observer = [system, []]
      system[0] = [[[], system], observer]

      assert.equal(observe(system), system)
      assert.equal(system[0][1], observer)
      assert.equal(observer[0], system)
    })

    test('root carries current value', () => {
      const root = []
      const current = [root, []]
      root[0] = []
      root[1] = current

      assert.equal(observe(root), current)
      assert.equal(observe(current), current)
      assert.equal(root[1], current)
      assert.equal(current[0], root)
    })

    test('carried observer contains its history', () => {
      const system = []
      const first = [system, []]
      const second = [system, first]
      system[0] = []
      system[1] = second

      assert.equal(observe(system), second)
      assert.equal(observe(second), second)
      assert.equal(second[0], system)
      assert.equal(second[1], first)
      assert.equal(first[0], system)
    })

    test('history observes through the current root', () => {
      const system = []
      const first = [system, []]
      const second = [system, first]
      system[0] = []
      system[1] = second

      assert.equal(observe(first), second)
      assert.equal(observe(second), second)
    })

    test('old history sees the newest value', () => {
      const system = []
      const first = [system, []]
      const second = [system, first]
      const third = [system, second]
      system[0] = []
      system[1] = third

      assert.equal(observe(first), third)
      assert.equal(observe(second), third)
      assert.equal(observe(third), third)
      assert.equal(third[1], second)
      assert.equal(second[1], first)
    })

    test('carried observer can be its own history', () => {
      const system = []
      const observer = []
      system[0] = []
      system[1] = observer
      observer[0] = system
      observer[1] = observer

      assert.equal(observe(system), observer)
      assert.equal(observe(observer), observer)
      assert.equal(observer[0], system)
      assert.equal(observer[1], observer)
    })
  })
})
