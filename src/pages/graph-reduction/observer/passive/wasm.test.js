// @ts-nocheck

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  I,
  createWasmCore,
  wasmBytes
} from './wasm.js'

const collapse = (core, next) => core.pair(I, next)

const share = (core, first, second, argument) =>
  core.pair(
    core.pair(first, argument),
    core.pair(second, argument)
  )

describe('wasm core', () => {
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

  test('pair writes flat left and right slots', async () => {
    const core = await createWasmCore()
    const first = core.pair()
    const second = core.pair()
    const pair = core.pair(first, second)
    const words = new Uint32Array(core.memory.buffer)

    assert.equal(core.size(), 3)
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
    const form = collapse(core, value)

    assert.equal(core.left(form), I)
    assert.equal(core.observe(form), value)
  })

  test('pair observes like its first child', async () => {
    const core = await createWasmCore()
    const value = core.pair()
    const context = core.pair()
    const next = collapse(core, value)
    const form = core.pair(next, context)

    assert.equal(core.observe(form), core.observe(next))
    assert.equal(core.observe(form), value)
  })

  test('pair creation is explicit and observable', async () => {
    const core = await createWasmCore()
    const before = core.size()
    const first = core.pair()
    const second = core.pair()
    const form = collapse(core, core.pair(first, second))
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

  test('fix creates a self-observing root', async () => {
    const core = await createWasmCore()
    const payload = core.pair()
    const root = core.pair()
    const cycle = core.pair(collapse(core, root), payload)
    core.setLeft(root, cycle)

    assert.equal(core.observe(root), root)
    assert.equal(core.right(core.left(root)), payload)
  })

  test('root and history carry current value', async () => {
    const core = await createWasmCore()
    const root = collapse(core, I)
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
    const root = collapse(core, I)
    const observer = core.pair(root, I)
    core.setRight(root, observer)
    core.setRight(observer, observer)

    assert.equal(core.observe(root), observer)
    assert.equal(core.observe(observer), observer)
    assert.equal(core.left(observer), root)
    assert.equal(core.right(observer), observer)
  })
})
