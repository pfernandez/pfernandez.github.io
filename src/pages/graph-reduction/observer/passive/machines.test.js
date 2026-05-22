import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { I, observe } from './observe.js'

describe('machines', () => {
  const fix = (next = I) => {
    const root = [I, I]
    root[0] = identity(root, root)
    root[1] = next
    return root
  }

  const observation = (observer, focus, createPair) =>
    createPair ? createPair(observer, focus) : [observer, focus]

  const identity = (observer, next = observer, createPair) =>
    createPair ? createPair(observer, next) : [observer, next]

  const closedMachine = (
    root,
    input = root,
    output = input,
    createPair
  ) => {
    const first = createPair ? createPair() : [I, I]
    const second = createPair ? createPair() : [I, I]
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
    const focus = [I, I]
    focus[0] = focus
    focus[1] = next
    return focus
  }

  const createFrameStep = frame => {
    const [observer, focus] = frame
    const [first, next] = focus

    if (first === observer) return next

    return [observer, first]
  }

  const linkedFrame = (observer, focus, future = I) =>
    [observer, [focus, future]]

  const selectLinkedFrame = frame => {
    const [observer, carried] = frame
    const [focus, nextFrame] = carried
    const [first, next] = focus

    if (first === observer) return next

    return nextFrame
  }

  const outputOf = machine => machine[1][1]
  const nextOnly = current => current[1]

  const event = (previous = I, output = I, createPair) =>
    createPair ? createPair(previous, output) : [previous, output]

  const port = (status = I, value = I, createPair) =>
    createPair ? createPair(status, value) : [status, value]

  describe('closed machines', () => {
    test('an orbit exposes its input as output', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return [first, next]
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
      const firstValue = [I, I]
      const nextValue = [I, I]
      const input = [firstValue, nextValue]
      const machine = [I, I]
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
      const firstValue = [I, I]
      const nextValue = [I, I]
      const input = [firstValue, nextValue]
      const machine = [I, I]
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
        return [first, next]
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
        return [first, next]
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
      const firstValue = [I, I]
      const nextValue = [I, I]
      const input = [firstValue, nextValue]
      const selector = [I, I]
      closedMachine(selector, input, input[0])
      const selected = outputOf(selector)
      const successor = [I, I]
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
        return [first, next]
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
      const selected = [I, I]
      const skipped = [I, I]
      const argument = [I, I]
      const firstApplication = [selected, argument]
      const nextApplication = [skipped, argument]
      const input = [firstApplication, nextApplication]
      const machine = [I, I]
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
        return [first, next]
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
        return [first, next]
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
        return [first, next]
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
      const filled = [I, I]
      const left = [I, I]
      const right = [I, I]
      const compiledForm = [left, right]
      const inputPort = port(empty, I)
      const machine = [I, I]
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
      const observer = [I, I]
      const next = [I, I]
      const localRoot = [I, I]
      const localNext = [I, I]
      const rooted = [identity(observer, next), [I, I]]
      const unrooted = [[localRoot, localNext], [I, I]]

      assert.equal(observe(observation(observer, rooted)), next)
      assert.notEqual(observe(observation(I, rooted)), next)
      assert.equal(observe(observation(localRoot, unrooted)), localNext)
      assert.notEqual(observe(observation(I, unrooted)), localNext)
      assert.equal(observe(observation(I, unrooted)), I)
    })

    test('a machine root is the local observer for its orbit', () => {
      const output = [I, I]
      const firstInput = [I, I]
      const secondInput = [I, I]
      const firstRoot = [I, I]
      const secondRoot = [I, I]
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
      const value = [I, I]
      const wrapper = [I, value]

      assert.equal(observeWhen(first => first === I, wrapper), value)
    })

    test('local collapse reads a self-left wrapper', () => {
      const value = [I, I]
      const wrapper = selfCollapse(value)

      assert.equal(
        observeWhen((first, focus) => first === focus, wrapper),
        value
      )
    })

    test('the predicates choose different wrappers', () => {
      const value = [I, I]
      const rootWrapper = [I, value]
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
      const value = [I, I]
      const focus = [I, value]
      const frame = linkedFrame(I, focus)

      assert.equal(selectLinkedFrame(frame), value)
      assert.equal(selectLinkedFrame(frame), observe(observation(I, focus)))
    })

    test('a frame selects its carried future while moving focus left', () => {
      const observer = [I, I]
      const value = [I, I]
      const focus = [[observer, value], [I, I]]
      const nextFrame = linkedFrame(observer, focus[0])
      const frame = linkedFrame(observer, focus, nextFrame)

      assert.equal(selectLinkedFrame(frame), nextFrame)
      assert.equal(selectLinkedFrame(nextFrame), value)
    })

    test('the same focus can collapse for one observer and move for another', () => {
      const firstObserver = [I, I]
      const secondObserver = [I, I]
      const value = [I, I]
      const focus = [firstObserver, value]
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
      const observer = [I, I]
      const result = [I, I]
      const finalFocus = [observer, result]
      const finalFrame = linkedFrame(observer, finalFocus)
      const initialFocus = [finalFocus, [I, I]]
      const initialFrame = linkedFrame(observer, initialFocus, finalFrame)

      assert.equal(selectLinkedFrame(initialFrame), finalFrame)
      assert.equal(selectLinkedFrame(finalFrame), result)
    })

    test('a cyclic future chain reuses frames while unfolding depth', () => {
      const observer = [I, I]
      const firstFocus = [I, I]
      const secondFocus = [I, I]
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
        return [first, next]
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
      const observer = [I, I]
      const value = [I, I]
      const focus = [[observer, value], [I, I]]
      const frame = [observer, focus]
      const existing = [observer, focus[0]]
      const created = createFrameStep(frame)

      assert.notEqual(created, existing)
      assert.equal(created[0], existing[0])
      assert.equal(created[1], existing[1])
    })
  })


  describe('next-only potential', () => {
    test('a compiled trace can advance with only next', () => {
      let allocations = 0
      const countedPair = (first = I, next = I) => {
        allocations += 1
        return [first, next]
      }
      const observer = countedPair()
      const value = countedPair()
      const match = countedPair(observer, value)
      const middle = countedPair(match, countedPair())
      const focus = countedPair(middle, countedPair())
      const matchState = countedPair(match, value)
      const middleState = countedPair(middle, matchState)
      const firstState = countedPair(focus, middleState)
      const built = allocations

      const secondState = nextOnly(firstState)
      const thirdState = nextOnly(secondState)
      const selected = nextOnly(thirdState)

      assert.equal(observe(observation(observer, focus)), value)
      assert.equal(allocations, built)
      assert.equal(firstState[0], focus)
      assert.equal(secondState[0], middle)
      assert.equal(thirdState[0], match)
      assert.equal(selected, value)
    })
  })


  describe('observer as data', () => {
    test('an observation frame observes like its focus', () => {
      const x = [I, I]
      const y = [I, I]
      const target = [[I, x], y]
      const frame = [target, I]

      assert.equal(observe(observation(I, frame)), observe(observation(I, target)))
      assert.equal(observe(observation(I, frame)), x)
      assert.equal(frame[0], target)
      assert.equal(frame[1], I)
    })

    test('a data observer can carry the current focus', () => {
      const observer = [I, I]
      const x = [I, I]
      const y = [I, I]
      const first = [I, x]
      const second = [[I, y], [I, I]]

      observer[0] = first
      observer[1] = I
      assert.equal(observe(observation(I, observer)), x)

      observer[0] = second
      assert.equal(observe(observation(I, observer)), y)
      assert.equal(observer[1], I)
    })

    test('a fixed first-position function cannot inspect its next', () => {
      const x = [I, I]
      const y = [I, I]
      const fixed = [[I, x], [I, I]]

      assert.equal(observe(observation(I, [fixed, x])), observe(observation(I, fixed)))
      assert.equal(observe(observation(I, [fixed, y])), observe(observation(I, fixed)))
      assert.equal(observe(observation(I, [I, x])), x)
      assert.equal(observe(observation(I, [I, y])), y)
    })

    test('a fixed collapse observes to itself instead of consuming next', () => {
      const fixedI = [I, I]
      const x = [I, I]
      fixedI[0] = I
      fixedI[1] = fixedI

      assert.equal(observe(observation(I, fixedI)), fixedI)
      assert.equal(observe(observation(I, [fixedI, x])), fixedI)
      assert.notEqual(observe(observation(I, [fixedI, x])), x)
    })

    test('root exposes the next frame from carried possibility', () => {
      const root = [I, I]
      const currentValue = [I, I]
      const nextValue = [I, I]
      const current = [[I, currentValue], I]
      const next = [[I, nextValue], I]
      const carried = [current, next]

      root[0] = [I, carried[1]]
      root[1] = carried

      assert.equal(root[1][0], current)
      assert.equal(root[1][1], next)
      assert.equal(observe(observation(I, root)), next)
      assert.equal(observe(observation(I, observe(observation(I, root)))), nextValue)
      assert.equal(observe(observation(I, current)), currentValue)
    })

    test('a linked frame can carry its observer and itself', () => {
      const observer = [I, I]
      const focus = [I, I]
      const frame = linkedFrame(observer, focus)
      frame[1][1] = frame

      assert.equal(selectLinkedFrame(frame), frame)
      assert.equal(frame[0], observer)
      assert.equal(frame[1][0], focus)
      assert.equal(frame[1][1], frame)
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
      const left = [I, I]
      const right = [I, I]
      const payload = [left, right]
      const root = fix(payload)

      assert.equal(observe(observation(root, root)), root)
      assert.equal(root[1], payload)
      assert.equal(payload[0], left)
      assert.equal(payload[1], right)
    })

    test('root carries current value', () => {
      const root = [I, I]
      const current = [root, I]
      root[0] = I
      root[1] = current

      assert.equal(observe(observation(I, root)), current)
      assert.equal(observe(observation(I, current)), current)
      assert.equal(root[1], current)
      assert.equal(current[0], root)
    })

    test('history observes through the current root', () => {
      const root = [I, I]
      const first = [root, I]
      const second = [root, first]
      const third = [root, second]
      root[0] = I
      root[1] = third

      assert.equal(observe(observation(I, first)), third)
      assert.equal(observe(observation(I, second)), third)
      assert.equal(observe(observation(I, third)), third)
      assert.equal(third[1], second)
      assert.equal(second[1], first)
    })

    test('observer can carry itself as history', () => {
      const root = [I, I]
      const observer = [I, I]
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
