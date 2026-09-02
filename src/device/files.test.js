import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assemble } from './files.js'

const root = `
  ((include ./pages.lisp)
   (include ./initial.lisp))
`
const dashboard = '((dashboard x x))'
const machine = '((machine x x))'
const sources = {
  '/src/root.lisp': root,
  '/src/pages/graph-reduction/dashboard.lisp': dashboard,
  '/src/pages/machine/machine.lisp': machine
}

test('assembles configured pages with the selected continuation', () => {
  const program = assemble(sources, '/graph-reduction/machine')
  const library = `((include /src/pages/graph-reduction/dashboard.lisp)
 (include /src/pages/machine/machine.lisp))`
  const initial = '((start (machine-initial machine-initial)))'

  assert.equal(
    program.source,
    `${dashboard}\n${machine}\n${library}\n${initial}\n${root}`)
  assert.deepEqual(program.ast, [
    ['dashboard', 'x', 'x'],
    ['machine', 'x', 'x'],
    ['start', ['machine-initial', 'machine-initial']]
  ])
  assert.equal(program.entry, root)
})

test('reports missing Root and selected page sources', () => {
  assert.throws(
    () => assemble({
      '/src/pages/graph-reduction/dashboard.lisp': dashboard
    }, '/graph-reduction'),
    /Missing root source: \/src\/root\.lisp/)

  assert.throws(
    () => assemble({ '/src/root.lisp': root }, '/graph-reduction'),
    /Missing page source: \/src\/pages\/graph-reduction\/dashboard\.lisp/)
})
