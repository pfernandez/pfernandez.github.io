import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  EMPTY,
  createWasmCore,
  wasmBytes
} from './wasm.js'

describe('wasm core', () => {
  test('module bytes are real WebAssembly', async () => {
    assert.equal(WebAssembly.validate(wasmBytes), true)

    const core = await createWasmCore()
    assert.ok(core.memory instanceof WebAssembly.Memory)
    assert.equal(core.size(), 0)
  })

  test('empty is a pointer sentinel, not an allocated pair', async () => {
    const core = await createWasmCore()

    assert.equal(EMPTY, 0)
    assert.equal(core.left(EMPTY), EMPTY)
    assert.equal(core.right(EMPTY), EMPTY)
    assert.equal(core.observe(EMPTY), EMPTY)
  })

  test('allocation writes flat left and right slots', async () => {
    const core = await createWasmCore()
    const first = core.alloc()
    const second = core.alloc()
    const pair = core.alloc(first, second)
    const words = new Uint32Array(core.memory.buffer)

    assert.equal(core.size(), 3)
    assert.equal(core.left(pair), first)
    assert.equal(core.right(pair), second)
    assert.equal(words[pair * 2], first)
    assert.equal(words[pair * 2 + 1], second)
  })

  test('equal shape is not the same pointer', async () => {
    const core = await createWasmCore()
    const first = core.alloc(EMPTY, EMPTY)
    const second = core.alloc(EMPTY, EMPTY)

    assert.notEqual(first, second)
    assert.equal(core.left(first), core.left(second))
    assert.equal(core.right(first), core.right(second))
  })

  test('application is ordinary pair structure', async () => {
    const core = await createWasmCore()
    const operator = core.alloc()
    const operand = core.alloc()
    const result = core.application(operator, operand)

    assert.equal(core.left(result), operator)
    assert.equal(core.right(result), operand)
  })

  test('setters mutate slots and return the pointer', async () => {
    const core = await createWasmCore()
    const pair = core.alloc()
    const first = core.alloc()
    const second = core.alloc()

    assert.equal(core.setLeft(pair, first), pair)
    assert.equal(core.setRight(pair, second), pair)
    assert.equal(core.left(pair), first)
    assert.equal(core.right(pair), second)
  })

  test('stable pair returns its right child', async () => {
    const core = await createWasmCore()
    const value = core.alloc()
    const form = core.stable(value)

    assert.equal(core.isStable(form), 1)
    assert.equal(core.observe(form), value)
  })

  test('I returns value', async () => {
    const core = await createWasmCore()
    const value = core.alloc()

    assert.equal(core.observe(core.stable(value)), value)
  })

  test('keep returns left', async () => {
    const core = await createWasmCore()
    const first = core.alloc()
    const second = core.alloc()

    assert.equal(core.observe(core.keep(first, second)), first)
  })

  test('right choice returns right', async () => {
    const core = await createWasmCore()
    const first = core.alloc()
    const second = core.alloc()

    assert.equal(core.observe(core.chooseRight(first, second)), second)
  })

  test('pair creation is explicit and observable', async () => {
    const core = await createWasmCore()
    const before = core.size()
    const first = core.alloc()
    const second = core.alloc()
    const form = core.exposePair(first, second)
    const result = core.observe(form)

    assert.equal(core.size(), before + 4)
    assert.equal(core.left(result), first)
    assert.equal(core.right(result), second)
  })

  test('share keeps one argument pointer in both applications', async () => {
    const core = await createWasmCore()
    const first = core.alloc()
    const second = core.alloc()
    const argument = core.alloc()
    const result = core.observe(core.share(first, second, argument))

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
    const payload = core.alloc()
    const root = core.fix(payload)

    assert.equal(core.observe(root), root)
    assert.equal(core.right(core.left(root)), payload)
  })

  test('root and history carry current value', async () => {
    const core = await createWasmCore()
    const root = core.createRoot()
    const first = core.carry(root, EMPTY)
    const second = core.carry(root, first)
    core.setCurrent(root, second)

    assert.equal(core.observe(root), second)
    assert.equal(core.observe(first), second)
    assert.equal(core.observe(second), second)
    assert.equal(core.right(second), first)
  })

  test('carried observer can be its own history', async () => {
    const core = await createWasmCore()
    const root = core.createRoot()
    const observer = core.alloc(root, EMPTY)
    core.setCurrent(root, observer)
    core.setRight(observer, observer)

    assert.equal(core.observe(root), observer)
    assert.equal(core.observe(observer), observer)
    assert.equal(core.left(observer), root)
    assert.equal(core.right(observer), observer)
  })
})
