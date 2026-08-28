import assert from 'node:assert/strict'
import { test } from 'node:test'
import { include, link } from './index.js'

test('includes file sequences in causal order', () => {
  const library = '((I x x))'
  const application = '((include library.lisp) (I a))'
  const program = include(application, { 'library.lisp': library })
  const { ast, focus, legend, source, error } = link(program)

  if (error) throw error
  assert.equal(source, `${library}\n${application}`)
  assert.equal(program.entry, application)
  assert.equal(program.files['library.lisp'], library)
  assert.deepEqual(ast, [['I', 'x', 'x'], ['I', 'a']])
  assert.equal(legend.get(focus[0]).name, 'a')
  assert.equal(focus[1], focus[0])
})

test('does not make a later file visible to an earlier one', () => {
  const program = include('((I a) (include library.lisp))', {
    'library.lisp': '((I x x))'
  })
  const { result, error } = link(program)

  if (error) throw error
  assert.equal(result, undefined)
})

test('includes files recursively', () => {
  const program = include('((include library.lisp) (I a))', {
    'core.lisp': '((I x x))',
    'library.lisp': '((include core.lisp))'
  })

  assert.deepEqual(program.ast, [['I', 'x', 'x'], ['I', 'a']])
})

test('reports missing and circular includes', () => {
  assert.throws(
    () => include('((include missing.lisp))'),
    /Missing include: missing\.lisp/)

  assert.throws(
    () => include('((include a.lisp))', {
      'a.lisp': '((include b.lisp))',
      'b.lisp': '((include a.lisp))'
    }),
    /Circular include: a\.lisp -> b\.lisp -> a\.lisp/)
})
