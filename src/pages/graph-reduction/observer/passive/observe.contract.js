import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

export const observeContract = (name, createMachine) => {
  describe(name, () => {
    test('empty observes to empty', async () => {
      const m = await createMachine()

      assert.equal(m.observe(m.empty), m.empty)
    })

    test('stable pair returns its right child', async () => {
      const m = await createMachine()
      const value = m.value()
      const form = m.stable(value)

      assert.equal(m.observe(form), value)
    })

    test('I returns value', async () => {
      const m = await createMachine()
      const value = m.value()

      assert.equal(m.observe(m.I(value)), value)
    })

    test('keep returns left', async () => {
      const m = await createMachine()
      const left = m.value()
      const right = m.value()

      assert.equal(m.observe(m.keep(left, right)), left)
    })

    test('right returns right', async () => {
      const m = await createMachine()
      const left = m.value()
      const right = m.value()

      assert.equal(m.observe(m.chooseRight(left, right)), right)
    })

    test('application is an ordinary pair', async () => {
      const m = await createMachine()
      const operator = m.value()
      const operand = m.value()
      const application = m.application(operator, operand)

      assert.equal(m.left(application), operator)
      assert.equal(m.right(application), operand)
    })

    test('pair creation exposes left and right', async () => {
      const m = await createMachine()
      const left = m.value()
      const right = m.value()
      const result = m.observe(m.exposePair(left, right))

      assert.equal(m.left(result), left)
      assert.equal(m.right(result), right)
    })

    test('share keeps one argument in both applications', async () => {
      const m = await createMachine()
      const first = m.value()
      const second = m.value()
      const argument = m.value()
      const result = m.observe(m.share(first, second, argument))

      assert.equal(m.left(m.left(result)), first)
      assert.equal(m.right(m.left(result)), argument)
      assert.equal(m.left(m.right(result)), second)
      assert.equal(m.right(m.right(result)), argument)
      assert.equal(m.right(m.left(result)), m.right(m.right(result)))
    })

    test('shared value stays shared after another observation', async () => {
      const m = await createMachine()
      const first = m.value()
      const second = m.value()
      const argument = m.value()
      const result = m.observe(m.share(first, second, argument))
      const next = m.stable(result)

      assert.equal(m.observe(next), result)
      assert.equal(m.right(m.left(result)), m.right(m.right(result)))
    })

    test('fix carries a payload without observing to it', async () => {
      const m = await createMachine()
      const payload = m.value()
      const root = m.fix(payload)

      assert.equal(m.observe(root), root)
      assert.equal(m.right(m.left(root)), payload)
    })

    test('root carries current value', async () => {
      const m = await createMachine()
      const root = m.createRoot()
      const current = m.carry(root)
      m.setCurrent(root, current)

      assert.equal(m.observe(root), current)
      assert.equal(m.observe(current), current)
      assert.equal(m.right(root), current)
      assert.equal(m.left(current), root)
    })

    test('history observes through the current root', async () => {
      const m = await createMachine()
      const root = m.createRoot()
      const first = m.carry(root)
      const second = m.carry(root, first)
      const third = m.carry(root, second)
      m.setCurrent(root, third)

      assert.equal(m.observe(first), third)
      assert.equal(m.observe(second), third)
      assert.equal(m.observe(third), third)
      assert.equal(m.right(third), second)
      assert.equal(m.right(second), first)
    })

    test('carried observer can be its own history', async () => {
      const m = await createMachine()
      const root = m.createRoot()
      const observer = m.pair(root, m.empty)
      m.setCurrent(root, observer)
      m.setRight(observer, observer)

      assert.equal(m.observe(root), observer)
      assert.equal(m.observe(observer), observer)
      assert.equal(m.left(observer), root)
      assert.equal(m.right(observer), observer)
    })
  })
}
