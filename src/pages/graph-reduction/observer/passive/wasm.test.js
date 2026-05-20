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

  const observation = (core, observer, focus) =>
    core.pair(observer, focus)

  const setObservation = (core, frame, observer, focus) => {
    core.setLeft(frame, observer)
    core.setRight(frame, focus)

    return frame
  }

  const linkedFrame = (core, observer, focus, future = I) =>
    core.pair(observer, core.pair(focus, future))

  const identity = (core, observer, next = observer) =>
    core.pair(observer, next)

  const event = (core, previous = I, output = I) =>
    core.pair(previous, output)

  const port = (core, status = I, value = I) =>
    core.pair(status, value)

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

  const closedMachine = (core, root, input = root, output = input) => {
    const first = core.pair()
    const second = core.pair()
    core.setLeft(root, input)
    core.setRight(root, first)
    core.setLeft(first, identity(core, root, second))
    core.setRight(first, output)
    core.setLeft(second, identity(core, root, first))
    core.setRight(second, output)

    return root
  }

  const outputOf = (core, machine) => core.right(core.right(machine))

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
    assert.equal(core.observe(observation(core, I, I)), I)
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
    assert.equal(core.observe(observation(core, I, I)), graph)
    assert.equal(core.observe(observation(core, I, graph)), graph)
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
    assert.equal(core.observe(observation(core, I, form)), value)
  })

  test('pair observes like its first child', async () => {
    const core = await createWasmCore()
    const value = core.pair()
    const context = core.pair()
    const next = core.pair(I, value)
    const form = core.pair(next, context)

    assert.equal(core.observe(observation(core, I, form)), core.observe(observation(core, I, next)))
    assert.equal(core.observe(observation(core, I, form)), value)
  })

  test('observe takes one step rather than normalizing', async () => {
    const core = await createWasmCore()
    const value = core.pair()
    const inner = core.pair(I, value)
    const outer = core.pair(I, inner)

    assert.equal(core.observe(observation(core, I, outer)), inner)
    assert.notEqual(core.observe(observation(core, I, outer)), value)
    assert.equal(
      core.observe(observation(
        core,
        I,
        core.observe(observation(core, I, outer))
      )),
      value
    )
  })

  test('pair creation is explicit and observable', async () => {
    const core = await createWasmCore()
    const frame = observation(core, I, I)
    const before = core.size()
    const first = core.pair()
    const second = core.pair()
    const form = core.pair(I, core.pair(first, second))
    const result = core.observe(setObservation(core, frame, I, form))

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

    assert.equal(core.observe(observation(core, I, firstPath)), value)
    assert.equal(core.observe(observation(core, I, secondPath)), value)
    assert.equal(core.observe(observation(core, I, firstPath)), core.observe(observation(core, I, secondPath)))
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

    assert.equal(core.observe(observation(core, I, first)), second)
    assert.equal(core.observe(observation(core, I, second)), first)
    assert.equal(
      core.observe(observation(
        core,
        I,
        core.observe(observation(core, I, first))
      )),
      first
    )
    assert.equal(
      core.observe(observation(
        core,
        I,
        core.observe(observation(core, I, second))
      )),
      second
    )
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
    const frame = observation(core, I, I)
    const built = core.size()

    const one = core.observe(setObservation(core, frame, I, first))
    const two = core.observe(setObservation(core, frame, I, one))
    const three = core.observe(setObservation(core, frame, I, two))

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
    const machine = core.pair()
    closedMachine(core, machine, input, input)
    const first = core.right(machine)
    const frame = observation(core, machine, I)
    const built = core.size()

    const second = core.observe(setObservation(core, frame, machine, first))
    const third = core.observe(setObservation(core, frame, machine, second))
    const fourth = core.observe(setObservation(core, frame, machine, third))

    assert.equal(core.size(), built)
    assert.equal(core.left(machine), input)
    assert.equal(core.right(machine), first)
    assert.equal(core.right(second), input)
    assert.equal(core.right(third), input)
    assert.equal(core.right(fourth), input)
    assert.equal(second, core.observe(setObservation(core, frame, machine, third)))
    assert.equal(third, core.observe(setObservation(core, frame, machine, second)))
  })

  test('a closed machine selects the first slot of its input', async () => {
    const core = await createWasmCore()
    const firstValue = core.pair()
    const nextValue = core.pair()
    const input = core.pair(firstValue, nextValue)
    const machine = core.pair()
    closedMachine(core, machine, input, core.left(input))
    const first = core.right(machine)
    const second = core.observe(observation(core, machine, first))
    const third = core.observe(observation(core, machine, second))

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
    const machine = core.pair()
    closedMachine(core, machine, input, core.right(input))
    const first = core.right(machine)
    const second = core.observe(observation(core, machine, first))
    const third = core.observe(observation(core, machine, second))

    assert.equal(core.left(machine), input)
    assert.equal(core.right(first), nextValue)
    assert.equal(core.right(second), nextValue)
    assert.equal(core.right(third), nextValue)
    assert.notEqual(core.right(first), firstValue)
  })

  test('a closed machine exposes the successor of its input', async () => {
    const core = await createWasmCore()
    const input = core.pair()
    const machine = core.pair()
    const output = identity(core, machine, input)
    closedMachine(core, machine, input, output)
    const first = core.right(machine)
    const frame = observation(core, machine, I)
    const built = core.size()

    const second = core.observe(setObservation(core, frame, machine, first))
    const third = core.observe(setObservation(core, frame, machine, second))

    assert.equal(core.size(), built)
    assert.equal(core.left(machine), input)
    assert.equal(core.right(first), output)
    assert.equal(core.right(second), output)
    assert.equal(core.right(third), output)
    assert.equal(core.left(output), machine)
    assert.equal(core.right(output), input)
    assert.equal(core.observe(setObservation(core, frame, machine, output)), input)
  })

  test('closed machines compose by sharing ports', async () => {
    const core = await createWasmCore()
    const input = core.pair()
    const source = core.pair()
    closedMachine(core, source, input, input)
    const sourceOutput = outputOf(core, source)
    const successor = core.pair()
    const output = identity(core, successor, sourceOutput)
    closedMachine(core, successor, sourceOutput, output)
    const frame = observation(core, source, I)
    const built = core.size()

    const sourceNext = core.observe(setObservation(
      core,
      frame,
      source,
      core.right(source)
    ))
    const successorNext = core.observe(setObservation(
      core,
      frame,
      successor,
      core.right(successor)
    ))

    assert.equal(core.size(), built)
    assert.equal(core.left(source), input)
    assert.equal(sourceOutput, input)
    assert.equal(core.left(successor), sourceOutput)
    assert.equal(outputOf(core, successor), output)
    assert.equal(core.right(sourceNext), sourceOutput)
    assert.equal(core.right(successorNext), output)
    assert.equal(core.right(output), input)
  })

  test('a closed selector can feed successor', async () => {
    const core = await createWasmCore()
    const firstValue = core.pair()
    const nextValue = core.pair()
    const input = core.pair(firstValue, nextValue)
    const selector = core.pair()
    closedMachine(core, selector, input, core.left(input))
    const selected = outputOf(core, selector)
    const successor = core.pair()
    const output = identity(core, successor, selected)
    closedMachine(core, successor, selected, output)

    assert.equal(selected, firstValue)
    assert.equal(core.left(successor), firstValue)
    assert.equal(outputOf(core, successor), output)
    assert.equal(
      core.right(core.observe(observation(core, selector, core.right(selector)))),
      firstValue
    )
    assert.equal(
      core.right(core.observe(observation(core, successor, core.right(successor)))),
      output
    )
    assert.equal(core.observe(observation(core, successor, output)), firstValue)
    assert.notEqual(core.right(output), nextValue)
  })

  test('a closed network exposes final output while components cycle', async () => {
    const core = await createWasmCore()
    const left = core.pair()
    const right = core.pair()
    const input = core.pair(left, right)
    const selector = core.pair()
    closedMachine(core, selector, input, core.right(input))
    const selected = outputOf(core, selector)
    const successor = core.pair()
    const root = core.pair()
    const output = identity(core, root, selected)
    closedMachine(core, successor, selected, output)
    const program = core.pair(selector, successor)
    const network = core.pair(input, program)
    closedMachine(core, root, network, output)
    const frame = observation(core, root, I)
    const built = core.size()

    const rootNext = core.observe(setObservation(
      core,
      frame,
      root,
      core.right(root)
    ))
    const selectorNext = core.observe(setObservation(
      core,
      frame,
      selector,
      core.right(selector)
    ))
    const successorNext = core.observe(setObservation(
      core,
      frame,
      successor,
      core.right(successor)
    ))

    assert.equal(core.size(), built)
    assert.equal(core.left(root), network)
    assert.equal(core.left(network), input)
    assert.equal(core.right(network), program)
    assert.equal(core.left(program), selector)
    assert.equal(core.right(program), successor)
    assert.equal(outputOf(core, root), output)
    assert.equal(core.right(rootNext), output)
    assert.equal(core.right(selectorNext), right)
    assert.equal(core.right(successorNext), output)
    assert.equal(core.right(output), right)
    assert.equal(core.observe(observation(core, root, output)), right)
  })

  test('a compiled selector application preserves sharing', async () => {
    const core = await createWasmCore()
    const selected = core.pair()
    const skipped = core.pair()
    const argument = core.pair()
    const firstApplication = core.pair(selected, argument)
    const nextApplication = core.pair(skipped, argument)
    const input = core.pair(firstApplication, nextApplication)
    const machine = core.pair()
    closedMachine(core, machine, input, core.left(input))
    const state = core.right(machine)
    const nextState = core.observe(observation(core, machine, state))

    assert.equal(outputOf(core, machine), firstApplication)
    assert.equal(core.right(state), firstApplication)
    assert.equal(core.right(nextState), firstApplication)
    assert.equal(core.left(firstApplication), selected)
    assert.equal(core.right(firstApplication), argument)
    assert.equal(core.right(nextApplication), argument)
    assert.equal(core.right(firstApplication), core.right(nextApplication))
  })

  test('output changes by moving to a prelinked event', async () => {
    const core = await createWasmCore()
    const root = core.pair()
    const firstValue = core.pair()
    const nextValue = core.pair()
    const firstOutput = identity(core, root, firstValue)
    const nextOutput = identity(core, root, nextValue)
    const firstState = core.pair()
    const nextState = core.pair()
    core.setLeft(firstState, identity(core, root, nextState))
    core.setRight(firstState, firstOutput)
    core.setLeft(nextState, identity(core, root, firstState))
    core.setRight(nextState, nextOutput)
    const frame = observation(core, root, I)
    const built = core.size()

    const secondState = core.observe(setObservation(core, frame, root, firstState))
    const thirdState = core.observe(setObservation(core, frame, root, secondState))

    assert.equal(core.size(), built)
    assert.equal(core.right(firstState), firstOutput)
    assert.equal(core.right(secondState), nextOutput)
    assert.equal(core.right(thirdState), firstOutput)
    assert.equal(
      core.observe(setObservation(core, frame, root, firstOutput)),
      firstValue
    )
    assert.equal(
      core.observe(setObservation(core, frame, root, nextOutput)),
      nextValue
    )
    assert.notEqual(firstOutput, nextOutput)
  })

  test('history is stored as prior events inside the graph', async () => {
    const core = await createWasmCore()
    const root = core.pair()
    const firstValue = core.pair()
    const secondValue = core.pair()
    const thirdValue = core.pair()
    const firstOutput = identity(core, root, firstValue)
    const secondOutput = identity(core, root, secondValue)
    const thirdOutput = identity(core, root, thirdValue)
    const firstEvent = event(core, root, firstOutput)
    const secondEvent = event(core, firstEvent, secondOutput)
    const thirdEvent = event(core, secondEvent, thirdOutput)
    const firstState = core.pair()
    const secondState = core.pair()
    const thirdState = core.pair()
    core.setLeft(firstState, identity(core, root, secondState))
    core.setRight(firstState, firstEvent)
    core.setLeft(secondState, identity(core, root, thirdState))
    core.setRight(secondState, secondEvent)
    core.setLeft(thirdState, identity(core, root, firstState))
    core.setRight(thirdState, thirdEvent)
    const frame = observation(core, root, I)
    const built = core.size()

    const afterFirst = core.observe(setObservation(core, frame, root, firstState))
    const afterSecond = core.observe(setObservation(core, frame, root, afterFirst))

    assert.equal(core.size(), built)
    assert.equal(afterFirst, secondState)
    assert.equal(afterSecond, thirdState)
    assert.equal(core.right(afterFirst), secondEvent)
    assert.equal(core.right(afterSecond), thirdEvent)
    assert.equal(core.left(thirdEvent), secondEvent)
    assert.equal(core.left(secondEvent), firstEvent)
    assert.equal(core.right(firstEvent), firstOutput)
    assert.equal(core.right(secondEvent), secondOutput)
    assert.equal(core.right(thirdEvent), thirdOutput)
    assert.equal(
      core.observe(setObservation(core, frame, root, firstOutput)),
      firstValue
    )
    assert.equal(
      core.observe(setObservation(core, frame, root, secondOutput)),
      secondValue
    )
    assert.equal(
      core.observe(setObservation(core, frame, root, thirdOutput)),
      thirdValue
    )
  })

  test('external IO can rewrite a stable output port', async () => {
    const core = await createWasmCore()
    const firstValue = core.pair()
    const nextValue = core.pair()
    const input = core.pair(firstValue, nextValue)
    const machine = core.pair()
    const outputCell = identity(core, machine, core.left(input))
    closedMachine(core, machine, input, outputCell)
    const firstState = core.right(machine)
    const frame = observation(core, machine, I)
    const secondState = core.observe(setObservation(
      core,
      frame,
      machine,
      firstState
    ))
    const outputPort = outputOf(core, machine)
    const built = core.size()

    assert.equal(outputPort, outputCell)
    assert.equal(
      core.observe(setObservation(core, frame, machine, outputPort)),
      firstValue
    )
    assert.equal(core.right(firstState), outputCell)
    assert.equal(core.right(secondState), outputCell)

    core.setRight(outputCell, core.right(input))
    const thirdState = core.observe(setObservation(
      core,
      frame,
      machine,
      secondState
    ))

    assert.equal(core.size(), built)
    assert.equal(core.right(machine), firstState)
    assert.equal(outputOf(core, machine), outputCell)
    assert.equal(outputPort, outputCell)
    assert.equal(
      core.observe(setObservation(core, frame, machine, outputPort)),
      nextValue
    )
    assert.equal(core.right(firstState), outputCell)
    assert.equal(core.right(secondState), outputCell)
    assert.equal(core.right(thirdState), outputCell)
  })

  test('a REPL boundary exchanges real graph forms through a port', async () => {
    const core = await createWasmCore()
    const empty = I
    const filled = identity(core, I, I)
    const left = core.pair()
    const right = core.pair()
    const compiledForm = core.pair(left, right)
    const inputPort = port(core, empty, I)
    const machine = core.pair()
    closedMachine(core, machine, inputPort, inputPort)
    const outputPort = outputOf(core, machine)

    core.setLeft(inputPort, filled)
    core.setRight(inputPort, compiledForm)

    assert.equal(outputPort, inputPort)
    assert.equal(core.left(outputPort), filled)
    assert.equal(core.right(outputPort), compiledForm)
    assert.equal(core.left(core.right(outputPort)), left)
    assert.equal(core.right(core.right(outputPort)), right)
    assert.equal(
      core.right(core.observe(observation(core, machine, core.right(machine)))),
      inputPort
    )
  })

  test('identity is relative to its observer', async () => {
    const core = await createWasmCore()
    const observer = core.pair()
    const next = core.pair()
    const localRoot = core.pair()
    const localNext = core.pair()
    const rooted = core.pair(identity(core, observer, next), core.pair())
    const unrooted = core.pair(core.pair(localRoot, localNext), core.pair())

    assert.equal(core.observe(observation(core, observer, rooted)), next)
    assert.notEqual(core.observe(observation(core, I, rooted)), next)
    assert.equal(core.observe(observation(core, localRoot, unrooted)), localNext)
    assert.notEqual(core.observe(observation(core, I, unrooted)), localNext)
    assert.equal(core.observe(observation(core, I, unrooted)), I)
  })

  test('a machine root is the local observer for its orbit', async () => {
    const core = await createWasmCore()
    const output = core.pair()
    const firstInput = core.pair()
    const secondInput = core.pair()
    const firstRoot = core.pair()
    const secondRoot = core.pair()
    closedMachine(core, firstRoot, firstInput, output)
    closedMachine(core, secondRoot, secondInput, output)

    assert.equal(outputOf(core, firstRoot), output)
    assert.equal(outputOf(core, secondRoot), output)
    assert.equal(
      core.right(core.observe(observation(core, firstRoot, core.right(firstRoot)))),
      output
    )
    assert.equal(
      core.right(core.observe(observation(core, secondRoot, core.right(secondRoot)))),
      output
    )
    assert.equal(core.left(firstRoot), firstInput)
    assert.equal(core.left(secondRoot), secondInput)
    assert.notEqual(core.left(firstRoot), core.left(secondRoot))
    assert.notEqual(core.right(firstRoot), core.right(secondRoot))
  })

  test('fix creates a self-observing root', async () => {
    const core = await createWasmCore()
    const payload = core.pair()
    const root = core.pair()
    const cycle = core.pair(identity(core, root, root), payload)
    core.setLeft(root, cycle)

    assert.equal(core.observe(observation(core, root, root)), root)
    assert.equal(core.right(core.left(root)), payload)
  })

  test('root and history carry current value', async () => {
    const core = await createWasmCore()
    const root = core.pair(I, I)
    const first = core.pair(root, I)
    const second = core.pair(root, first)
    core.setRight(root, second)

    assert.equal(core.observe(observation(core, I, root)), second)
    assert.equal(core.observe(observation(core, I, first)), second)
    assert.equal(core.observe(observation(core, I, second)), second)
    assert.equal(core.right(second), first)
  })

  test('carried observer can be its own history', async () => {
    const core = await createWasmCore()
    const root = core.pair(I, I)
    const observer = core.pair(root, I)
    core.setRight(root, observer)
    core.setRight(observer, observer)

    assert.equal(core.observe(observation(core, I, root)), observer)
    assert.equal(core.observe(observation(core, I, observer)), observer)
    assert.equal(core.left(observer), root)
    assert.equal(core.right(observer), observer)
  })

  test('succ reuses one cycle without allocating after construction', async () => {
    const core = await createWasmCore()
    const root = core.pair()
    core.setLeft(root, I)
    core.setRight(root, core.pair(I, root))
    const frame = observation(core, I, I)
    const built = core.size()

    const one = core.observe(setObservation(core, frame, I, root))
    const two = core.observe(setObservation(core, frame, I, one))
    const three = core.observe(setObservation(core, frame, I, two))
    const four = core.observe(setObservation(core, frame, I, three))

    assert.equal(core.size(), built)
    assert.equal(one, core.right(root))
    assert.equal(two, root)
    assert.equal(three, core.right(root))
    assert.equal(four, root)
  })
})
