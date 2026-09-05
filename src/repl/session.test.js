import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link, serialize } from '../graph/index.js'
import { submit, undo } from './session.js'

const output = linked => serialize(linked.result ?? linked.focus, {
  labels: true,
  legend: linked.legend
})

test('appends submissions as causally ordered forms', () => {
  const defined = submit(undefined, '(I x x)')
  const applied = submit(defined, '(I a)')
  const followed = submit(applied, '(I b)')

  assert.deepEqual(applied.ast, [
    ['I', 'x', 'x'],
    ['I', 'a']
  ])
  assert.equal(output(applied), 'a')
  assert.equal(output(followed), 'b')
})

test('matches the equivalent authored program', () => {
  const first = submit(undefined, '(I x x)')
  const second = submit(first, '(I a)')
  const program = link('((I x x) (I a))')

  if (program.error) throw program.error
  assert.equal(output(second), output(program))
})

test('does not make a later definition visible to an earlier submission', () => {
  const used = submit(undefined, '(I a)')
  const defined = submit(used, '(I x x)')

  assert.equal(used.result, undefined)
  assert.equal(defined.result, undefined)
})

test('does not change a session after invalid input', () => {
  const session = submit(undefined, '(I x x)')

  assert.throws(() => submit(session, '(I a'), /Missing \)/)
  assert.deepEqual(session.ast, [['I', 'x', 'x']])
  assert.equal(session.entries.length, 1)
})

test('constructs a fresh Root for each submission', () => {
  const first = submit(undefined, '(I x x)')
  const second = submit(first, '(I a)')

  assert.notEqual(second.graph, first.graph)
  assert.ok(Object.isFrozen(first.graph))
  assert.ok(Object.isFrozen(second.graph))
})

test('undoes the latest submission', () => {
  const first = submit(undefined, '(I x x)')
  const second = submit(first, '(I a)')
  const restored = undo(second)

  assert.deepEqual(restored.ast, first.ast)
  assert.equal(restored.source, first.source)
  assert.equal(restored.graph, first.graph)
  assert.equal(undo(restored), undefined)
})
