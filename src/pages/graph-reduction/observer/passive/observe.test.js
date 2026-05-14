import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { observe } from './observe.js'

describe('observe', () => {
  test('empty', () => assert.deepEqual(observe([]), []))

  test('collapse', () => {
    assert.deepEqual(observe([[], []]), [])
    assert.deepEqual(observe([[], [[], []]]), [[], []])
  })

  test('identity', () => {
    const x = [[], []]
    assert.equal(observe([[], x]), x)
  })

  test('first', () => {
    const x = [[], []]
    const y = [[], []]
    assert.equal(observe([[[], x], y]), x)
  })

  test('next', () => {
    const x = [[], []]
    const y = [[], []]
    const $ = [[[], x], y]
    $[0][0][0] = []
    $[0][0][1] = $[1]
    assert.equal(observe($), y)
  })

  test('bind', () => {
    const x = [[], []]
    const y = [[], []]
    const $ = [[[[], []], x], y]

    $[0][0][1][0] = $[0][1]
    $[0][0][1][1] = $[1]

    assert.deepEqual(observe($), [x, y])
  })

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

  test('result keeps the current root', () => {
    const system = []
    const a = [[], []]
    const b = [[], []]
    const $ = [[[[], a], b], system]
    $[0][0][0] = [[], [[a, system], [b, system]]]
    system[0] = []
    system[1] = $

    const result = observe($)
    assert.deepEqual(result, [[a, system], [b, system]])
    assert.equal(result[0][1], system)
    assert.equal(result[1][1], system)
    assert.equal(result[0][1], result[1][1])
    assert.equal(observe(system), $)
  })

  test('fix', async () => {
    const isAtom = pair => !Array.isArray(pair)
    const isEmpty = pair => !pair.length

    const $ = []
    const x = [[], []]
    $[0] = [[[], $], x]

    assert.deepEqual(observe($), $)
    assert.equal(observe($)[0][1], x)
    assert.ok(!isAtom($))
    assert.ok(!isEmpty($))
  })

  test('nest', () => {
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

  test('fixed point carries a cons cell', () => {
    const left = [[], []]
    const right = [[], []]
    const cell = [left, right]
    const $ = []
    $[0] = [[[], $], cell]

    assert.equal(observe($), $)
    assert.equal($[0][1], cell)
    assert.equal(cell[0], left)
    assert.equal(cell[1], right)
  })

  test('first reads the carried left value', () => {
    const left = [[], []]
    const right = [[], []]
    const cell = [left, right]
    const first = [[[], cell[0]], cell[1]]

    assert.equal(observe(first), left)
  })

  test('rest reads the carried right value', () => {
    const left = [[], []]
    const right = [[], []]
    const cell = [left, right]
    const rest = [[[], cell[0]], cell[1]]

    rest[0][0][0] = []
    rest[0][0][1] = cell[1]

    assert.equal(observe(rest), right)
  })

  test('fixed point carries a payload', () => {
    const $ = []
    const payload = [[], []]
    $[0] = [[[], $], payload]

    assert.equal(observe($), $)
    assert.equal($[0][1], payload)
  })

  test('fixed point can carry an observer', () => {
    const system = []
    const observer = [system, []]
    system[0] = [[[], system], observer]

    assert.equal(observe(system), system)
    assert.equal(system[0][1], observer)
    assert.equal(observer[0], system)
  })

  test('system collapses to its carried observer', () => {
    const system = []
    const observer = [system, []]
    system[0] = []
    system[1] = observer

    assert.equal(observe(system), observer)
    assert.equal(observe(observer), observer)
    assert.equal(observer[0], system)
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
