// @ts-nocheck

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  I,
  createWasmCore,
  wasmBytes
} from './wasm.js'

describe('wasm core', () => {
  const share = (core, first, second, argument) =>
    core.pair(
      core.pair(first, argument),
      core.pair(second, argument)
    )

  const linkedFrame = (core, observer, focus, future = I) =>
    core.pair(observer, core.pair(focus, future))

  const selectLinkedFrame = (core, frame) => {
    const observer = core.left(frame)
    const carried = core.right(frame)
    const focus = core.left(carried)
    const nextFrame = core.right(carried)
    const first = core.left(focus)
    const next = core.right(focus)

    if (first === observer) return next

    return nextFrame
  }

  const closedMachine = (core, input, output) => {
    const first = core.pair()
    const second = core.pair()
    core.setLeft(first, core.pair(I, second))
    core.setRight(first, output)
    core.setLeft(second, core.pair(I, first))
    core.setRight(second, output)

    return core.pair(input, first)
  }

  test('module bytes are real WebAssembly', async () => {
    assert.equal(WebAssembly.validate(wasmBytes), true)

    const core = await createWasmCore()
    assert.ok(core.memory instanceof WebAssembly.Memory)
    assert.equal(core.size(), 0)
  })

  test('I is the root fixed point, not an allocated pair', async () => {
    const core = await createWasmCore()

    assert.equal(I, 0)
    assert.equal(core.left(I), I)
    assert.equal(core.right(I), I)
    assert.equal(core.observe(I), I)
  })

  test('the root can open to a loaded graph', async () => {
    const core = await createWasmCore()
    const graph = core.pair()
    core.setRight(graph, graph)
    core.setRight(I, graph)

    assert.equal(core.left(I), I)
    assert.equal(core.right(I), graph)
    assert.equal(core.left(graph), I)
    assert.equal(core.right(graph), graph)
    assert.equal(core.observe(I), graph)
    assert.equal(core.observe(graph), graph)
  })

  test('pair writes flat left and right slots', async () => {
    const core = await createWasmCore()
    const before = core.size()
    const first = core.pair()
    const second = core.pair()
    const pair = core.pair(first, second)
    const words = new Uint32Array(core.memory.buffer)

    assert.equal(core.size(), before + 3)
    assert.equal(core.left(pair), first)
    assert.equal(core.right(pair), second)
    assert.equal(words[pair * 2], first)
    assert.equal(words[pair * 2 + 1], second)
  })

  test('equal shape is not the same pointer', async () => {
    const core = await createWasmCore()
    const first = core.pair(I, I)
    const second = core.pair(I, I)

    assert.notEqual(first, second)
    assert.equal(core.left(first), core.left(second))
    assert.equal(core.right(first), core.right(second))
  })

  test('application is ordinary pair structure', async () => {
    const core = await createWasmCore()
    const operator = core.pair()
    const operand = core.pair()
    const result = core.pair(operator, operand)

    assert.equal(core.left(result), operator)
    assert.equal(core.right(result), operand)
  })

  test('setters mutate slots and return the pointer', async () => {
    const core = await createWasmCore()
    const pair = core.pair()
    const first = core.pair()
    const second = core.pair()

    assert.equal(core.setLeft(pair, first), pair)
    assert.equal(core.setRight(pair, second), pair)
    assert.equal(core.left(pair), first)
    assert.equal(core.right(pair), second)
  })

  test('collapse returns its next', async () => {
    const core = await createWasmCore()
    const value = core.pair()
    const form = core.pair(I, value)

    assert.equal(core.left(form), I)
    assert.equal(core.observe(form), value)
  })

  test('pair observes like its first child', async () => {
    const core = await createWasmCore()
    const value = core.pair()
    const context = core.pair()
    const next = core.pair(I, value)
    const form = core.pair(next, context)

    assert.equal(core.observe(form), core.observe(next))
    assert.equal(core.observe(form), value)
  })

  test('observe takes one step rather than normalizing', async () => {
    const core = await createWasmCore()
    const value = core.pair()
    const inner = core.pair(I, value)
    const outer = core.pair(I, inner)

    assert.equal(core.observe(outer), inner)
    assert.notEqual(core.observe(outer), value)
    assert.equal(core.observe(core.observe(outer)), value)
  })

  test('pair creation is explicit and observable', async () => {
    const core = await createWasmCore()
    const before = core.size()
    const first = core.pair()
    const second = core.pair()
    const form = core.pair(I, core.pair(first, second))
    const result = core.observe(form)

    assert.equal(core.size(), before + 4)
    assert.equal(core.left(result), first)
    assert.equal(core.right(result), second)
  })

  test('share keeps one argument pointer in both applications', async () => {
    const core = await createWasmCore()
    const first = core.pair()
    const second = core.pair()
    const argument = core.pair()
    const result = share(core, first, second, argument)

    assert.equal(core.left(core.left(result)), first)
    assert.equal(core.right(core.left(result)), argument)
    assert.equal(core.left(core.right(result)), second)
    assert.equal(core.right(core.right(result)), argument)
    assert.equal(
      core.right(core.left(result)),
      core.right(core.right(result))
    )
  })

  test('observation preserves sharing through different paths', async () => {
    const core = await createWasmCore()
    const value = core.pair()
    const shared = core.pair(I, value)
    const firstPath = core.pair(shared, core.pair())
    const secondPath = core.pair(core.pair(shared, core.pair()), core.pair())

    assert.equal(core.observe(firstPath), value)
    assert.equal(core.observe(secondPath), value)
    assert.equal(core.observe(firstPath), core.observe(secondPath))
  })

  test('a prelinked future frame is selected by identity', async () => {
    const core = await createWasmCore()
    const observer = core.pair()
    const value = core.pair()
    const focus = core.pair(core.pair(observer, value), I)
    const nextFrame = linkedFrame(core, observer, core.left(focus))
    const sameShape = linkedFrame(core, observer, core.left(focus))
    const frame = linkedFrame(core, observer, focus, nextFrame)
    const selected = selectLinkedFrame(core, frame)

    assert.equal(selected, nextFrame)
    assert.notEqual(selected, sameShape)
    assert.equal(core.left(core.right(selected)), core.left(focus))
  })

  test('the same focus can collapse for one observer and move for another', async () => {
    const core = await createWasmCore()
    const firstObserver = core.pair()
    const secondObserver = core.pair()
    const value = core.pair()
    const focus = core.pair(firstObserver, value)
    const future = linkedFrame(core, secondObserver, firstObserver)
    const firstFrame = linkedFrame(core, firstObserver, focus)
    const secondFrame = linkedFrame(core, secondObserver, focus, future)

    assert.equal(selectLinkedFrame(core, firstFrame), value)
    assert.equal(selectLinkedFrame(core, secondFrame), future)
    assert.equal(core.left(focus), firstObserver)
    assert.equal(core.right(focus), value)
  })

  test('a cyclic future chain does not allocate while unfolding', async () => {
    const core = await createWasmCore()
    const observer = core.pair()
    const firstFocus = core.pair()
    const secondFocus = core.pair()
    const firstFrame = linkedFrame(core, observer, firstFocus)
    const secondFrame = linkedFrame(core, observer, secondFocus, firstFrame)
    core.setLeft(firstFocus, secondFocus)
    core.setLeft(secondFocus, firstFocus)
    core.setRight(core.right(firstFrame), secondFrame)
    const built = core.size()

    const one = selectLinkedFrame(core, firstFrame)
    const two = selectLinkedFrame(core, one)
    const three = selectLinkedFrame(core, two)
    const four = selectLinkedFrame(core, three)

    assert.equal(core.size(), built)
    assert.equal(one, secondFrame)
    assert.equal(two, firstFrame)
    assert.equal(three, secondFrame)
    assert.equal(four, firstFrame)
  })

  test('a closed graph carries its own next observation', async () => {
    const core = await createWasmCore()
    const first = core.pair()
    const second = core.pair()
    core.setLeft(first, I)
    core.setRight(first, second)
    core.setLeft(second, I)
    core.setRight(second, first)

    assert.equal(core.observe(first), second)
    assert.equal(core.observe(second), first)
    assert.equal(core.observe(core.observe(first)), first)
    assert.equal(core.observe(core.observe(second)), second)
  })

  test('a closed orbit exposes a stable output port', async () => {
    const core = await createWasmCore()
    const output = core.pair()
    const first = core.pair()
    const second = core.pair()
    core.setLeft(first, core.pair(I, second))
    core.setRight(first, output)
    core.setLeft(second, core.pair(I, first))
    core.setRight(second, output)
    const built = core.size()

    const one = core.observe(first)
    const two = core.observe(one)
    const three = core.observe(two)

    assert.equal(core.size(), built)
    assert.equal(one, second)
    assert.equal(two, first)
    assert.equal(three, second)
    assert.equal(core.right(first), output)
    assert.equal(core.right(second), output)
    assert.equal(core.right(one), output)
    assert.equal(core.right(two), output)
  })

  test('a closed machine exposes its input as output', async () => {
    const core = await createWasmCore()
    const input = core.pair()
    const machine = closedMachine(core, input, input)
    const first = core.right(machine)
    const built = core.size()

    const second = core.observe(first)
    const third = core.observe(second)
    const fourth = core.observe(third)

    assert.equal(core.size(), built)
    assert.equal(core.left(machine), input)
    assert.equal(core.right(machine), first)
    assert.equal(core.right(second), input)
    assert.equal(core.right(third), input)
    assert.equal(core.right(fourth), input)
    assert.equal(second, core.observe(third))
    assert.equal(third, core.observe(second))
  })

  test('a closed machine selects the first slot of its input', async () => {
    const core = await createWasmCore()
    const firstValue = core.pair()
    const nextValue = core.pair()
    const input = core.pair(firstValue, nextValue)
    const machine = closedMachine(core, input, core.left(input))
    const first = core.right(machine)
    const second = core.observe(first)
    const third = core.observe(second)

    assert.equal(core.left(machine), input)
    assert.equal(core.right(first), firstValue)
    assert.equal(core.right(second), firstValue)
    assert.equal(core.right(third), firstValue)
    assert.notEqual(core.right(first), nextValue)
  })

  test('a closed machine selects the next slot of its input', async () => {
    const core = await createWasmCore()
    const firstValue = core.pair()
    const nextValue = core.pair()
    const input = core.pair(firstValue, nextValue)
    const machine = closedMachine(core, input, core.right(input))
    const first = core.right(machine)
    const second = core.observe(first)
    const third = core.observe(second)

    assert.equal(core.left(machine), input)
    assert.equal(core.right(first), nextValue)
    assert.equal(core.right(second), nextValue)
    assert.equal(core.right(third), nextValue)
    assert.notEqual(core.right(first), firstValue)
  })

  test('a closed machine exposes the successor of its input', async () => {
    const core = await createWasmCore()
    const input = core.pair()
    const output = core.pair(I, input)
    const machine = closedMachine(core, input, output)
    const first = core.right(machine)
    const built = core.size()

    const second = core.observe(first)
    const third = core.observe(second)

    assert.equal(core.size(), built)
    assert.equal(core.left(machine), input)
    assert.equal(core.right(first), output)
    assert.equal(core.right(second), output)
    assert.equal(core.right(third), output)
    assert.equal(core.left(output), I)
    assert.equal(core.right(output), input)
    assert.equal(core.observe(output), input)
  })

  test('fix creates a self-observing root', async () => {
    const core = await createWasmCore()
    const payload = core.pair()
    const root = core.pair()
    const cycle = core.pair(core.pair(I, root), payload)
    core.setLeft(root, cycle)

    assert.equal(core.observe(root), root)
    assert.equal(core.right(core.left(root)), payload)
  })

  test('root and history carry current value', async () => {
    const core = await createWasmCore()
    const root = core.pair(I, I)
    const first = core.pair(root, I)
    const second = core.pair(root, first)
    core.setRight(root, second)

    assert.equal(core.observe(root), second)
    assert.equal(core.observe(first), second)
    assert.equal(core.observe(second), second)
    assert.equal(core.right(second), first)
  })

  test('carried observer can be its own history', async () => {
    const core = await createWasmCore()
    const root = core.pair(I, I)
    const observer = core.pair(root, I)
    core.setRight(root, observer)
    core.setRight(observer, observer)

    assert.equal(core.observe(root), observer)
    assert.equal(core.observe(observer), observer)
    assert.equal(core.left(observer), root)
    assert.equal(core.right(observer), observer)
  })

  test('succ reuses one cycle without allocating after construction', async () => {
    const core = await createWasmCore()
    const root = core.pair()
    core.setLeft(root, I)
    core.setRight(root, core.pair(I, root))
    const built = core.size()

    const one = core.observe(root)
    const two = core.observe(one)
    const three = core.observe(two)
    const four = core.observe(three)

    assert.equal(core.size(), built)
    assert.equal(one, core.right(root))
    assert.equal(two, root)
    assert.equal(three, core.right(root))
    assert.equal(four, root)
  })
})
