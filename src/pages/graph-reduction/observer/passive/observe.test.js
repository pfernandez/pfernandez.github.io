import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { I, observe, pair } from './observe.js'

describe('observe', () => {
  const fix = (next = I) => {
    const root = pair()
    root[0] = identity(root, root)
    root[1] = next
    return root
  }

  const share = (first, second, argument) =>
    pair(pair(first, argument), pair(second, argument))

  const observation = (observer, focus, createPair = pair) =>
    createPair(observer, focus)

  const identity = (observer, next = observer, createPair = pair) =>
    createPair(observer, next)

  const closedMachine = (
    root,
    input = root,
    output = input,
    createPair = pair
  ) => {
    const first = createPair()
    const second = createPair()
    root[0] = input
    root[1] = first
    first[0] = identity(root, second, createPair)
    first[1] = output
    second[0] = identity(root, first, createPair)
    second[1] = output

    return root
  }

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

  const outputOf = machine => machine[1][1]

  const event = (previous = I, output = I, createPair = pair) =>
    createPair(previous, output)

  const port = (status = I, value = I, createPair = pair) =>
    createPair(status, value)

  describe('basis contract', () => {
    test('I is a pair and the root graph', () => {
      const x = pair()

      assert.equal(I[0], I)
      assert.equal(I[1], I)
      assert.equal(I.length, 2)
      assert.notEqual(x, I)
    })

    test('I observes to itself', () => assert.equal(observe(observation(I, I)), I))

    test('the root can open to a loaded graph', () => {
      const graph = pair()
      const previous = I[1]

      graph[1] = graph
      I[1] = graph

      try {
        assert.equal(I[0], I)
        assert.equal(I[1], graph)
        assert.equal(observe(observation(I, I)), graph)
        assert.equal(observe(observation(I, graph)), graph)
      } finally {
        I[1] = previous
      }
    })

    test('collapse returns its next', () => {
      const x = pair()

      assert.equal(observe(observation(I, identity(I, x))), x)
    })

    test('pair observes like its first child', () => {
      const x = pair()
      const context = pair()
      const next = pair(I, x)
      const form = pair(next, context)

      assert.equal(observe(observation(I, form)), observe(observation(I, next)))
      assert.equal(observe(observation(I, form)), x)
    })

    test('observe takes one step rather than normalizing', () => {
      const value = pair()
      const inner = pair(I, value)
      const outer = pair(I, inner)

      assert.equal(observe(observation(I, outer)), inner)
      assert.notEqual(observe(observation(I, outer)), value)
      assert.equal(observe(observation(I, observe(observation(I, outer)))), value)
    })

    test('observation preserves sharing through different paths', () => {
      const value = pair()
      const shared = pair(I, value)
      const firstPath = pair(shared, pair())
      const secondPath = pair(pair(shared, pair()), pair())

      assert.equal(observe(observation(I, firstPath)), value)
      assert.equal(observe(observation(I, secondPath)), value)
      assert.equal(observe(observation(I, firstPath)), observe(observation(I, secondPath)))
    })

    test('a prelinked future is selected by identity', () => {
      const observer = pair()
      const value = pair()
      const focus = pair(pair(observer, value), I)
      const nextFrame = linkedFrame(observer, focus[0])
      const sameShape = linkedFrame(observer, focus[0])
      const frame = linkedFrame(observer, focus, nextFrame)
      const selected = selectLinkedFrame(frame)

      assert.equal(selected, nextFrame)
      assert.notEqual(selected, sameShape)
      assert.deepEqual(selected, sameShape)
    })

    test('a closed graph carries its own next observation', () => {
      const first = pair()
      const second = pair()
      first[0] = I
      first[1] = second
      second[0] = I
      second[1] = first

      assert.equal(observe(observation(I, first)), second)
      assert.equal(observe(observation(I, second)), first)
      assert.equal(observe(observation(I, observe(observation(I, first)))), first)
      assert.equal(observe(observation(I, observe(observation(I, second)))), second)
    })

    test('a closed orbit exposes a stable output port', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const output = countedPair()
      const first = countedPair()
      const second = countedPair()
      first[0] = countedPair(I, second)
      first[1] = output
      second[0] = countedPair(I, first)
      second[1] = output
      const built = allocations

      const one = observe(observation(I, first))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))

      assert.equal(allocations, built)
      assert.equal(one, second)
      assert.equal(two, first)
      assert.equal(three, second)
      assert.equal(first[1], output)
      assert.equal(second[1], output)
      assert.equal(one[1], output)
      assert.equal(two[1], output)
    })

    test('succ reuses one cycle without allocating after construction', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const root = countedPair()
      root[0] = I
      root[1] = countedPair(I, root)
      const built = allocations

      const one = observe(observation(I, root))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))
      const four = observe(observation(I, three))

      assert.equal(allocations, built)
      assert.equal(one, root[1])
      assert.equal(two, root)
      assert.equal(three, root[1])
      assert.equal(four, root)
    })
  })

  describe('closed machines', () => {
    test('an orbit exposes its input as output', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const input = countedPair()
      const machine = countedPair()
      closedMachine(machine, input, input, countedPair)
      const first = machine[1]
      const built = allocations

      const second = observe(observation(machine, first))
      const third = observe(observation(machine, second))
      const fourth = observe(observation(machine, third))

      assert.equal(allocations, built)
      assert.equal(machine[0], input)
      assert.equal(machine[1], first)
      assert.equal(second[1], input)
      assert.equal(third[1], input)
      assert.equal(fourth[1], input)
      assert.equal(second, observe(observation(machine, third)))
      assert.equal(third, observe(observation(machine, second)))
    })

    test('an orbit selects the first slot of its input', () => {
      const firstValue = pair()
      const nextValue = pair()
      const input = pair(firstValue, nextValue)
      const machine = pair()
      closedMachine(machine, input, input[0])
      const first = machine[1]
      const second = observe(observation(machine, first))
      const third = observe(observation(machine, second))

      assert.equal(machine[0], input)
      assert.equal(first[1], firstValue)
      assert.equal(second[1], firstValue)
      assert.equal(third[1], firstValue)
      assert.notEqual(first[1], nextValue)
    })

    test('an orbit selects the next slot of its input', () => {
      const firstValue = pair()
      const nextValue = pair()
      const input = pair(firstValue, nextValue)
      const machine = pair()
      closedMachine(machine, input, input[1])
      const first = machine[1]
      const second = observe(observation(machine, first))
      const third = observe(observation(machine, second))

      assert.equal(machine[0], input)
      assert.equal(first[1], nextValue)
      assert.equal(second[1], nextValue)
      assert.equal(third[1], nextValue)
      assert.notEqual(first[1], firstValue)
    })

    test('an orbit exposes the successor of its input', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const input = countedPair()
      const machine = countedPair()
      const output = identity(machine, input, countedPair)
      closedMachine(machine, input, output, countedPair)
      const first = machine[1]
      const built = allocations

      const second = observe(observation(machine, first))
      const third = observe(observation(machine, second))

      assert.equal(allocations, built)
      assert.equal(machine[0], input)
      assert.equal(first[1], output)
      assert.equal(second[1], output)
      assert.equal(third[1], output)
      assert.equal(output[0], machine)
      assert.equal(output[1], input)
      assert.equal(observe(observation(machine, output)), input)
    })
  })

  describe('closed composition', () => {
    test('machines compose by sharing ports', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const input = countedPair()
      const source = countedPair()
      closedMachine(source, input, input, countedPair)
      const sourceOutput = outputOf(source)
      const successor = countedPair()
      const output = identity(successor, sourceOutput, countedPair)
      closedMachine(successor, sourceOutput, output, countedPair)
      const built = allocations

      const sourceNext = observe(observation(source, source[1]))
      const successorNext = observe(observation(successor, successor[1]))

      assert.equal(allocations, built)
      assert.equal(source[0], input)
      assert.equal(sourceOutput, input)
      assert.equal(successor[0], sourceOutput)
      assert.equal(outputOf(successor), output)
      assert.equal(sourceNext[1], sourceOutput)
      assert.equal(successorNext[1], output)
      assert.equal(output[1], input)
    })

    test('a selector can feed successor', () => {
      const firstValue = pair()
      const nextValue = pair()
      const input = pair(firstValue, nextValue)
      const selector = pair()
      closedMachine(selector, input, input[0])
      const selected = outputOf(selector)
      const successor = pair()
      const output = identity(successor, selected)
      closedMachine(successor, selected, output)

      assert.equal(selected, firstValue)
      assert.equal(successor[0], firstValue)
      assert.equal(outputOf(successor), output)
      assert.equal(observe(observation(selector, selector[1]))[1], firstValue)
      assert.equal(observe(observation(successor, successor[1]))[1], output)
      assert.equal(observe(observation(successor, output)), firstValue)
      assert.notEqual(output[1], nextValue)
    })

    test('a closed network exposes final output while components cycle', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const left = countedPair()
      const right = countedPair()
      const input = countedPair(left, right)
      const selector = countedPair()
      closedMachine(selector, input, input[1], countedPair)
      const selected = outputOf(selector)
      const successor = countedPair()
      const root = countedPair()
      const output = identity(root, selected, countedPair)
      closedMachine(successor, selected, output, countedPair)
      const program = countedPair(selector, successor)
      const network = countedPair(input, program)
      closedMachine(root, network, output, countedPair)
      const built = allocations

      const rootNext = observe(observation(root, root[1]))
      const selectorNext = observe(observation(selector, selector[1]))
      const successorNext = observe(observation(successor, successor[1]))

      assert.equal(allocations, built)
      assert.equal(root[0], network)
      assert.equal(network[0], input)
      assert.equal(network[1], program)
      assert.equal(program[0], selector)
      assert.equal(program[1], successor)
      assert.equal(outputOf(root), output)
      assert.equal(rootNext[1], output)
      assert.equal(selectorNext[1], right)
      assert.equal(successorNext[1], output)
      assert.equal(output[1], right)
      assert.equal(observe(observation(root, output)), right)
    })
  })

  describe('closed evaluation', () => {
    test('a compiled selector application preserves sharing', () => {
      const selected = pair()
      const skipped = pair()
      const argument = pair()
      const firstApplication = pair(selected, argument)
      const nextApplication = pair(skipped, argument)
      const input = pair(firstApplication, nextApplication)
      const machine = pair()
      closedMachine(machine, input, input[0])
      const state = machine[1]
      const nextState = observe(observation(machine, state))

      assert.equal(outputOf(machine), firstApplication)
      assert.equal(state[1], firstApplication)
      assert.equal(nextState[1], firstApplication)
      assert.equal(firstApplication[0], selected)
      assert.equal(firstApplication[1], argument)
      assert.equal(nextApplication[1], argument)
      assert.equal(firstApplication[1], nextApplication[1])
    })
  })

  describe('causal lattice', () => {
    test('output changes by moving to a prelinked event', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const root = countedPair()
      const firstValue = countedPair()
      const nextValue = countedPair()
      const firstOutput = identity(root, firstValue, countedPair)
      const nextOutput = identity(root, nextValue, countedPair)
      const firstState = countedPair()
      const nextState = countedPair()
      firstState[0] = identity(root, nextState, countedPair)
      firstState[1] = firstOutput
      nextState[0] = identity(root, firstState, countedPair)
      nextState[1] = nextOutput
      const built = allocations

      const secondState = observe(observation(root, firstState))
      const thirdState = observe(observation(root, secondState))

      assert.equal(allocations, built)
      assert.equal(firstState[1], firstOutput)
      assert.equal(secondState[1], nextOutput)
      assert.equal(thirdState[1], firstOutput)
      assert.equal(observe(observation(root, firstOutput)), firstValue)
      assert.equal(observe(observation(root, nextOutput)), nextValue)
      assert.notEqual(firstOutput, nextOutput)
    })

    test('history is stored as prior events inside the graph', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const root = countedPair()
      const firstValue = countedPair()
      const secondValue = countedPair()
      const thirdValue = countedPair()
      const firstOutput = identity(root, firstValue, countedPair)
      const secondOutput = identity(root, secondValue, countedPair)
      const thirdOutput = identity(root, thirdValue, countedPair)
      const firstEvent = event(root, firstOutput, countedPair)
      const secondEvent = event(firstEvent, secondOutput, countedPair)
      const thirdEvent = event(secondEvent, thirdOutput, countedPair)
      const firstState = countedPair()
      const secondState = countedPair()
      const thirdState = countedPair()
      firstState[0] = identity(root, secondState, countedPair)
      firstState[1] = firstEvent
      secondState[0] = identity(root, thirdState, countedPair)
      secondState[1] = secondEvent
      thirdState[0] = identity(root, firstState, countedPair)
      thirdState[1] = thirdEvent
      const built = allocations

      const afterFirst = observe(observation(root, firstState))
      const afterSecond = observe(observation(root, afterFirst))

      assert.equal(allocations, built)
      assert.equal(afterFirst, secondState)
      assert.equal(afterSecond, thirdState)
      assert.equal(afterFirst[1], secondEvent)
      assert.equal(afterSecond[1], thirdEvent)
      assert.equal(thirdEvent[0], secondEvent)
      assert.equal(secondEvent[0], firstEvent)
      assert.equal(firstEvent[1], firstOutput)
      assert.equal(secondEvent[1], secondOutput)
      assert.equal(thirdEvent[1], thirdOutput)
      assert.equal(observe(observation(root, firstOutput)), firstValue)
      assert.equal(observe(observation(root, secondOutput)), secondValue)
      assert.equal(observe(observation(root, thirdOutput)), thirdValue)
    })
  })

  describe('IO boundary', () => {
    test('external IO can rewrite a stable output port', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const firstValue = countedPair()
      const nextValue = countedPair()
      const input = countedPair(firstValue, nextValue)
      const machine = countedPair()
      const outputCell = identity(machine, input[0], countedPair)
      closedMachine(machine, input, outputCell, countedPair)
      const firstState = machine[1]
      const secondState = observe(observation(machine, firstState))
      const outputPort = outputOf(machine)
      const built = allocations

      assert.equal(outputPort, outputCell)
      assert.equal(observe(observation(machine, outputPort)), firstValue)
      assert.equal(firstState[1], outputCell)
      assert.equal(secondState[1], outputCell)

      outputCell[1] = input[1]
      const thirdState = observe(observation(machine, secondState))

      assert.equal(allocations, built)
      assert.equal(machine[1], firstState)
      assert.equal(outputOf(machine), outputCell)
      assert.equal(outputPort, outputCell)
      assert.equal(observe(observation(machine, outputPort)), nextValue)
      assert.equal(firstState[1], outputCell)
      assert.equal(secondState[1], outputCell)
      assert.equal(thirdState[1], outputCell)
    })

    test('a REPL boundary exchanges real graph forms through a port', () => {
      const empty = I
      const filled = pair(I, I)
      const left = pair()
      const right = pair()
      const compiledForm = pair(left, right)
      const inputPort = port(empty, I)
      const machine = pair()
      closedMachine(machine, inputPort, inputPort)
      const outputPort = outputOf(machine)

      inputPort[0] = filled
      inputPort[1] = compiledForm

      assert.equal(outputPort, inputPort)
      assert.equal(outputPort[0], filled)
      assert.equal(outputPort[1], compiledForm)
      assert.equal(outputPort[1][0], left)
      assert.equal(outputPort[1][1], right)
      assert.equal(observe(observation(machine, machine[1]))[1], inputPort)
    })
  })

  describe('roots', () => {
    test('identity is relative to its observer', () => {
      const observer = pair()
      const next = pair()
      const localRoot = pair()
      const localNext = pair()
      const rooted = pair(identity(observer, next), pair())
      const unrooted = pair(pair(localRoot, localNext), pair())

      assert.equal(observe(observation(observer, rooted)), next)
      assert.notEqual(observe(observation(I, rooted)), next)
      assert.equal(observe(observation(localRoot, unrooted)), localNext)
      assert.notEqual(observe(observation(I, unrooted)), localNext)
      assert.equal(observe(observation(I, unrooted)), I)
    })

    test('a machine root is the local observer for its orbit', () => {
      const output = pair()
      const firstInput = pair()
      const secondInput = pair()
      const firstRoot = pair()
      const secondRoot = pair()
      closedMachine(firstRoot, firstInput, output)
      closedMachine(secondRoot, secondInput, output)

      assert.equal(outputOf(firstRoot), output)
      assert.equal(outputOf(secondRoot), output)
      assert.equal(observe(observation(firstRoot, firstRoot[1]))[1], output)
      assert.equal(observe(observation(secondRoot, secondRoot[1]))[1], output)
      assert.equal(firstRoot[0], firstInput)
      assert.equal(secondRoot[0], secondInput)
      assert.notEqual(firstRoot[0], secondRoot[0])
      assert.notEqual(firstRoot[1], secondRoot[1])
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
      assert.equal(selectLinkedFrame(frame), observe(observation(I, focus)))
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
      assert.equal(focus[0], firstObserver)
      assert.equal(focus[1], value)
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

    test('a cyclic future chain does not allocate while unfolding', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return pair(first, next)
      }
      const countedLinkedFrame = (observer, focus, future = I) =>
        countedPair(observer, countedPair(focus, future))

      const observer = countedPair()
      const firstFocus = countedPair()
      const secondFocus = countedPair()
      const firstFrame = countedLinkedFrame(observer, firstFocus)
      const secondFrame = countedLinkedFrame(observer, secondFocus, firstFrame)
      firstFocus[0] = secondFocus
      secondFocus[0] = firstFocus
      firstFrame[1][1] = secondFrame
      const built = allocations

      const one = selectLinkedFrame(firstFrame)
      const two = selectLinkedFrame(one)
      const three = selectLinkedFrame(two)
      const four = selectLinkedFrame(three)

      assert.equal(allocations, built)
      assert.equal(one, secondFrame)
      assert.equal(two, firstFrame)
      assert.equal(three, secondFrame)
      assert.equal(four, firstFrame)
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

      assert.equal(observe(observation(I, frame)), observe(observation(I, target)))
      assert.equal(observe(observation(I, frame)), x)
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
      assert.equal(observe(observation(I, observer)), x)

      observer[0] = second
      assert.equal(observe(observation(I, observer)), y)
      assert.equal(observer[1], I)
    })

    test('a fixed first-position function cannot inspect its next', () => {
      const x = pair()
      const y = pair()
      const fixed = pair(pair(I, x), pair())

      assert.equal(observe(observation(I, pair(fixed, x))), observe(observation(I, fixed)))
      assert.equal(observe(observation(I, pair(fixed, y))), observe(observation(I, fixed)))
      assert.equal(observe(observation(I, pair(I, x))), x)
      assert.equal(observe(observation(I, pair(I, y))), y)
    })

    test('a fixed collapse observes to itself instead of consuming next', () => {
      const fixedI = pair()
      const x = pair()
      fixedI[0] = I
      fixedI[1] = fixedI

      assert.equal(observe(observation(I, fixedI)), fixedI)
      assert.equal(observe(observation(I, pair(fixedI, x))), fixedI)
      assert.notEqual(observe(observation(I, pair(fixedI, x))), x)
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
      assert.equal(observe(observation(I, root)), next)
      assert.equal(observe(observation(I, observe(observation(I, root)))), nextValue)
      assert.equal(observe(observation(I, current)), currentValue)
    })

    test('a linked frame can carry its observer and itself', () => {
      const observer = pair()
      const focus = pair()
      const frame = linkedFrame(observer, focus)
      frame[1][1] = frame

      assert.equal(selectLinkedFrame(frame), frame)
      assert.equal(frame[0], observer)
      assert.equal(frame[1][0], focus)
      assert.equal(frame[1][1], frame)
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
      assert.equal(observe(observation(I, form)), right)
    })

    test('a pair can be assembled from carried slots', () => {
      const left = pair()
      const right = pair()
      const result = pair()
      const form = pair(pair(pair(I, result), left), right)

      result[0] = form[0][1]
      result[1] = form[1]

      assert.equal(observe(observation(I, form)), result)
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
      assert.deepEqual(observe(observation(I, form)), share(x, y, z))
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
      assert.equal(observe(observation(I, form)), result)
      assert.deepEqual(result, share(x, y, z))
      assert.equal(result[0][1], result[1][1])
    })

    test('shared value stays shared after another observation', () => {
      const x = pair()
      const y = pair()
      const z = pair()
      const result = share(x, y, z)
      const next = pair(I, result)

      assert.equal(observe(observation(I, next)), result)
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

      assert.deepEqual(observe(observation(I, form)), share(a, b, root))
      assert.equal(result[0][1], root)
      assert.equal(result[1][1], root)
      assert.equal(result[0][1], result[1][1])
      assert.equal(observe(observation(I, root)), form)
    })
  })

  describe('selectors', () => {
    test('left and right are collapse reads of pair slots', () => {
      const left = pair()
      const right = pair()
      const subject = pair(left, right)

      assert.equal(observe(observation(I, pair(I, subject[0]))), left)
      assert.equal(observe(observation(I, pair(I, subject[1]))), right)
    })
  })

  describe('depth', () => {
    test('succ', () => {
      const root = pair()
      root[0] = I
      root[1] = pair(I, root)

      const one = observe(observation(I, root))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))

      assert.deepEqual(one, pair(I, root))
      assert.deepEqual(two, pair(I, pair(I, root)))
      assert.deepEqual(three, pair(I, pair(I, pair(I, root))))
    })

    test('depths share one fixed point', () => {
      const root = pair()
      root[0] = I
      root[1] = pair(I, root)

      const one = observe(observation(I, root))
      const two = observe(observation(I, one))
      const three = observe(observation(I, two))

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
      assert.equal(observe(observation(I, one)), zero)
      assert.equal(observe(observation(I, two)), one)
      assert.equal(observe(observation(I, three)), two)
    })
  })

  describe('fixed roots', () => {
    test('root evaluates to itself through its own collapse', () => {
      const root = fix()

      assert.equal(observe(observation(root, root)), root)
      assert.equal(observe(observation(root, observe(observation(root, root)))), root)
      assert.equal(root[0][0], root)
      assert.equal(root[0][1], root)
    })

    test('fixed root observes to itself while carrying a payload', () => {
      const left = pair()
      const right = pair()
      const payload = pair(left, right)
      const root = fix(payload)

      assert.equal(observe(observation(root, root)), root)
      assert.equal(root[1], payload)
      assert.equal(payload[0], left)
      assert.equal(payload[1], right)
    })

    test('root carries current value', () => {
      const root = pair()
      const current = pair(root)
      root[0] = I
      root[1] = current

      assert.equal(observe(observation(I, root)), current)
      assert.equal(observe(observation(I, current)), current)
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

      assert.equal(observe(observation(I, first)), third)
      assert.equal(observe(observation(I, second)), third)
      assert.equal(observe(observation(I, third)), third)
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

      assert.equal(observe(observation(I, root)), observer)
      assert.equal(observe(observation(I, observer)), observer)
      assert.equal(observer[0], root)
      assert.equal(observer[1], observer)
    })
  })
})
