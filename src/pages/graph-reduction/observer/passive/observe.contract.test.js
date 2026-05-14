import {
  EMPTY,
  I,
  application,
  carry,
  chooseRight,
  createHeap,
  createRoot,
  exposePair,
  fix,
  keep,
  left,
  observe,
  pair,
  right,
  setCurrent,
  setRight,
  share,
  stable
} from './core.js'
import { observe as observeArray } from './observe.js'
import { observeContract } from './observe.contract.js'
import { createWasmCore } from './wasm.js'

const createArrayMachine = () => {
  const empty = []

  return {
    empty,
    value: () => [[], []],
    observe: observeArray,
    left: value => value[0],
    right: value => value[1],
    setRight: (value, next) => {
      value[1] = next
      return value
    },
    pair: (left, right) => [left, right],
    application: (operator, operand) => [operator, operand],
    stable: value => [empty, value],
    I: value => [empty, value],
    keep: (left, right) => [[empty, left], right],
    chooseRight: (left, right) => [[empty, right], left],
    exposePair: (left, right) => [empty, [left, right]],
    share: (first, second, argument) => (
      [empty, [[first, argument], [second, argument]]]
    ),
    fix: payload => {
      const root = []
      root[0] = [[empty, root], payload]
      return root
    },
    createRoot: (current = empty) => [empty, current],
    carry: (root, previous = empty) => [root, previous],
    setCurrent: (root, current) => {
      root[1] = current
      return root
    }
  }
}

const createPointerMachine = () => {
  const heap = createHeap()

  return {
    empty: EMPTY,
    value: () => pair(heap, EMPTY, EMPTY),
    observe: value => observe(heap, value),
    left: value => left(heap, value),
    right: value => right(heap, value),
    setRight: (value, next) => setRight(heap, value, next),
    pair: (leftValue, rightValue) => pair(heap, leftValue, rightValue),
    application: (operator, operand) => application(heap, operator, operand),
    stable: value => stable(heap, value),
    I: value => I(heap, value),
    keep: (leftValue, rightValue) => keep(heap, leftValue, rightValue),
    chooseRight: (leftValue, rightValue) => (
      chooseRight(heap, leftValue, rightValue)
    ),
    exposePair: (leftValue, rightValue) => (
      exposePair(heap, leftValue, rightValue)
    ),
    share: (first, second, argument) => share(heap, first, second, argument),
    fix: payload => fix(heap, payload),
    createRoot: (current = EMPTY) => createRoot(heap, current),
    carry: (root, previous = EMPTY) => carry(heap, root, previous),
    setCurrent: (root, current) => setCurrent(heap, root, current)
  }
}

const createWasmMachine = async () => {
  const core = await createWasmCore()

  return {
    empty: EMPTY,
    value: () => core.alloc(EMPTY, EMPTY),
    observe: core.observe,
    left: core.left,
    right: core.right,
    setRight: core.setRight,
    pair: core.alloc,
    application: core.application,
    stable: core.stable,
    I: core.stable,
    keep: core.keep,
    chooseRight: core.chooseRight,
    exposePair: core.exposePair,
    share: core.share,
    fix: core.fix,
    createRoot: core.createRoot,
    carry: core.carry,
    setCurrent: core.setCurrent
  }
}

observeContract('array observe contract', createArrayMachine)
observeContract('pointer observe contract', createPointerMachine)
observeContract('wasm observe contract', createWasmMachine)
