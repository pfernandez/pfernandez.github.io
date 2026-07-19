import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { image } from '../wasm/image.js'
import { observe } from './index.js'

describe('graph-native lens', () => {
  // A lens state is `[event, next]`. Runtime stepping follows the right edge.
  // Passive observation of the state exposes the stable event on the left.
  // The event carries `[previousEvent, output]`, so history is graph structure.
  //
  // This is hand-built for now: current Lisp can express a single boundary, but
  // not yet a clean prelinked chain whose next event reuses the prior event's
  // actual identity as a plain value.
  const withCounter = () => {
    let allocations = 0
    const pair = (left, right) => {
      allocations += 1
      return [left, right]
    }
    const atom = () => {
      const node = pair(null, null)
      node[0] = node
      node[1] = node
      return node
    }
    const event = (previous, output) => {
      const node = pair(null, pair(previous, output))
      node[0] = node
      return node
    }
    const state = (event, next = null) =>
      pair(event, next)

    return {
      atom,
      event,
      pair,
      state,
      allocations: () => allocations
    }
  }

  const step = state =>
    state[1]

  const previous = event =>
    event[1][0]

  const output = event =>
    event[1][1]

  const historyDepth = (event, root) =>
    event === root ? 0 : 1 + historyDepth(previous(event), root)

  test('right-edge stepping can carry stable events on the left', () => {
    const graph = withCounter()
    const root = graph.atom()
    const firstOutput = graph.atom()
    const secondOutput = graph.atom()
    const thirdOutput = graph.atom()
    const firstEvent = graph.event(root, firstOutput)
    const secondEvent = graph.event(firstEvent, secondOutput)
    const thirdEvent = graph.event(secondEvent, thirdOutput)
    const first = graph.state(firstEvent)
    const second = graph.state(secondEvent)
    const third = graph.state(thirdEvent)

    first[1] = second
    second[1] = third
    third[1] = first

    const built = graph.allocations()

    assert.equal(observe(first), firstEvent)
    assert.equal(observe(step(first)), secondEvent)
    assert.equal(observe(step(step(first))), thirdEvent)
    assert.equal(step(step(step(first))), first)

    assert.equal(observe(firstEvent), firstEvent)
    assert.equal(output(firstEvent), firstOutput)
    assert.equal(output(secondEvent), secondOutput)
    assert.equal(output(thirdEvent), thirdOutput)
    assert.equal(historyDepth(thirdEvent, root), 3)

    let current = first
    for (let i = 0; i < 12; i += 1)
      current = step(current)

    assert.equal(graph.allocations(), built)
    assert.doesNotThrow(() => image(first))
  })
})
