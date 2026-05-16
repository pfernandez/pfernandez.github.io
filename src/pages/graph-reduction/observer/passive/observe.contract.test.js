import { createBasis } from './basis.js'
import { EMPTY, alloc, createHeap, left, observe, right, setLeft, setRight }
  from './core.js'
import { observe as observeArray } from './observe.js'
import { observeContract } from './observe.contract.js'
import { createWasmCore } from './wasm.js'

const createArrayMachine = () => {
  const empty = []
  const pair = (left = empty, right = empty) => [left, right]
  const setLeft = (value, next) => {
    value[0] = next
    return value
  }
  const setRight = (value, next) => {
    value[1] = next
    return value
  }
  const basis = createBasis({
    empty,
    pair,
    setLeft,
    setRight
  })

  return {
    empty,
    value: () => pair(),
    observe: observeArray,
    left: value => value[0],
    right: value => value[1],
    setRight,
    pair,
    ...basis
  }
}

const createPointerMachine = () => {
  const heap = createHeap()
  const pair = (leftValue = EMPTY, rightValue = EMPTY) =>
    alloc(heap, leftValue, rightValue)

  const setLeftValue = (value, next) => setLeft(heap, value, next)
  const setRightValue = (value, next) => setRight(heap, value, next)
  const basis = createBasis({
    empty: EMPTY,
    pair,
    setLeft: setLeftValue,
    setRight: setRightValue
  })

  return {
    empty: EMPTY,
    value: () => pair(),
    observe: value => observe(heap, value),
    left: value => left(heap, value),
    right: value => right(heap, value),
    setRight: setRightValue,
    pair,
    ...basis
  }
}

const createWasmMachine = async () => {
  const core = await createWasmCore()
  const pair = (leftValue = EMPTY, rightValue = EMPTY) =>
    core.alloc(leftValue, rightValue)

  const basis = createBasis({
    empty: EMPTY,
    pair,
    setLeft: core.setLeft,
    setRight: core.setRight
  })

  return {
    empty: EMPTY,
    value: () => pair(),
    observe: core.observe,
    left: core.left,
    right: core.right,
    setRight: core.setRight,
    pair,
    ...basis
  }
}

observeContract('array observe contract', createArrayMachine)
observeContract('pointer observe contract', createPointerMachine)
observeContract('wasm observe contract', createWasmMachine)
