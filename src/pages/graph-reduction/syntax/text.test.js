import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link, observe } from '../graph/index.js'
import { compile } from './text.js'

test('compiles lexical names to structural references', () => {
  const program = compile(`
  (
   ((I ((I (x (() ()))) x))
    ())
   (I (a (() ())))
  )
  `)
  const { graph, error } = link(program.source)

  assert.equal(error, undefined)
  assert.deepEqual(program.legend.map(entry => entry.symbol), ['I', 'x', 'a'])
  assert.equal(observe(graph[1]), program.legend[2].node)
  assert.equal(program.legend[0].node[0][0], program.legend[0].node)
  assert.equal(program.legend[0].node[0][1], program.legend[1].node)
  assert.equal(program.legend[0].node[1], program.legend[1].node)
  assert.deepEqual(
    program.decorate(graph).map(entry => entry.symbol),
    ['I'])
})

test('rejects undefined names', () => {
  assert.throws(() => compile('(I missing)'), /Undefined name: missing/)
})
