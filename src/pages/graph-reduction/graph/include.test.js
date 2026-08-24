import assert from 'node:assert/strict'
import { test } from 'node:test'
import { include, link } from './index.js'

test('includes file sequences in causal order', () => {
  const library = '((I x x))'
  const application = '((I a))'
  const program = include(library, application)
  const { ast, focus, source, error } = link(program)

  if (error) throw error
  assert.equal(source, `${library}\n${application}`)
  assert.deepEqual(ast, [['I', 'x', 'x'], ['I', 'a']])
  assert.equal(focus[0]['symbol'], 'a')
  assert.equal(focus[1], focus[0])
})

test('does not make a later file visible to an earlier one', () => {
  const { result, error } = link(include('((I a))', '((I x x))'))

  if (error) throw error
  assert.equal(result, undefined)
})
