import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { image } from '../wasm/image.js'
import { compile, observe, serialize } from './index.js'
import {
  event,
  historyDepth,
  output,
  previous,
  step
} from './lens.js'

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
    assert.equal(event(first), firstEvent)
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

  test('source can name lens states and stable events', () => {
    const source = `
      (End (End End))
      (E0 (E0 (Root Out0)))
      (E1 (E1 (E0 Out1)))
      (E2 (E2 (E1 Out2)))
      (S2 (E2 End))
      (S1 (E1 S2))
      (S0 (E0 S1))
      S0
    `
    const { graph, legend } = compile(source)
    const firstEvent = observe(graph)
    const secondEvent = observe(step(graph))
    const thirdEvent = observe(step(step(graph)))

    assert.equal(serialize(graph, { legend }), '(E0 (E1 (E2 End)))')
    assert.equal(event(graph), firstEvent)
    assert.equal(output(firstEvent), output(firstEvent)[0])
    assert.equal(serialize(output(firstEvent), { legend }), 'Out0')
    assert.equal(serialize(output(secondEvent), { legend }), 'Out1')
    assert.equal(serialize(output(thirdEvent), { legend }), 'Out2')
    assert.equal(previous(secondEvent), firstEvent)
    assert.equal(previous(thirdEvent), secondEvent)
    assert.equal(serialize(step(step(step(graph))), { legend }), '(End End)')
    assert.doesNotThrow(() => image(graph))
  })

  test('lens fixture carries program-shaped outputs', () => {
    const source = readFileSync(new URL('../lens.lisp', import.meta.url))
    const { graph, legend } = compile(source.toString())
    const firstEvent = observe(graph)
    const secondEvent = observe(step(graph))

    assert.equal(serialize(graph, { legend }), '(E0 (E1 End))')
    assert.equal(serialize(output(firstEvent), { legend }), '(((S a) b) c)')
    assert.equal(serialize(output(secondEvent), { legend }), '((a c) (b c))')
    assert.equal(previous(secondEvent), firstEvent)
    assert.equal(serialize(step(step(graph)), { legend }), '(End End)')
    assert.doesNotThrow(() => image(graph))
  })
})
