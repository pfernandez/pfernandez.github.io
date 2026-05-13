import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { infer, observe, step } from './observe.js'

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

    assert.deepEqual(observe($), [[x, z], [y, z]])
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

  test('observer records boundaries', () => {
    const empty = []
    const graph = [[], [[], empty]]

    const root = [graph, []]
    const one = step(root)
    const two = step(one)
    const three = step(two)

    assert.equal(one[0], graph[1])
    assert.equal(one[1], root)
    assert.deepEqual(infer(one), [])

    assert.equal(two[0], empty)
    assert.equal(two[1], one)
    assert.deepEqual(infer(two), [])

    assert.equal(three[0], empty)
    assert.equal(three[1], two)
    assert.equal(infer(three), two)
  })

  test('observer distinguishes fixed point ticks', () => {
    const $ = []
    $[0] = []
    $[1] = [[], $]

    const root = [$, []]
    const one = step(root)
    const two = step(one)
    const three = step(two)

    assert.equal(two[0], $)
    assert.equal(three[0], one[0])
    assert.equal(one[1], root)
    assert.equal(two[1], one)
    assert.equal(three[1], two)
    assert.deepEqual(infer(three), [])
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

  test('self-contained system stabilizes through its observer', () => {
    const system = []
    const observer = [system, []]
    system[0] = [[[], system], observer]

    const next = step(observer)

    assert.equal(next[0], system)
    assert.equal(next[1], observer)
    assert.equal(infer(next), observer)
  })
})
