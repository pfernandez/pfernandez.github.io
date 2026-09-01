import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assembleProgram } from './program.js'

const root = '((include ./content.lisp) (root content))'
const dashboard = '((dashboard x x))'
const machine = '((machine x x))'
const sources = {
  '/src/root.lisp': root,
  '/src/pages/graph-reduction/dashboard.lisp': dashboard,
  '/src/pages/machine/machine.lisp': machine
}

test('assembles the selected page before Root', () => {
  const program = assembleProgram(sources, '/graph-reduction/machine')

  assert.equal(program.source, `${machine}\n${root}`)
  assert.deepEqual(program.ast, [
    ['machine', 'x', 'x'],
    ['root', 'content']
  ])
  assert.equal(program.entry, root)
})

test('reports missing Root and page sources', () => {
  assert.throws(
    () => assembleProgram({
      '/src/pages/graph-reduction/dashboard.lisp': dashboard
    }, '/graph-reduction'),
    /Missing root source: \/src\/root\.lisp/)

  assert.throws(
    () => assembleProgram({ '/src/root.lisp': root }, '/graph-reduction'),
    /Missing page source: \/src\/pages\/graph-reduction\/dashboard\.lisp/)
})
