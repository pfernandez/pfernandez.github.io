import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assemble } from './files.js'

const root = `
  ((include /src/pages/pages.lisp)
   (include ./initial.lisp))
`
const dashboard = '((dashboard x x))'
const machine = '((machine x x))'
const pageManifest = `
  ((include /src/pages/graph-reduction/dashboard.lisp)
   (include /src/pages/machine/machine.lisp)
   (site self
     ((pages
       (((items
         (((label Dashboard)
           (route /graph-reduction)
           (source /src/pages/graph-reduction/dashboard.lisp)
           (default true))
          ((label Machine)
           (route /graph-reduction/machine)
           (source /src/pages/machine/machine.lisp))))))))))
`
const sources = {
  '/src/root.lisp': root,
  '/src/pages/pages.lisp': pageManifest,
  '/src/pages/graph-reduction/dashboard.lisp': dashboard,
  '/src/pages/machine/machine.lisp': machine
}

test('assembles configured pages with the selected continuation', () => {
  const program = assemble(sources, '/graph-reduction/machine')
  const initial = '((start (machine-initial machine-initial)))'

  assert.equal(
    program.source,
    `${dashboard}\n${machine}\n${pageManifest}\n${initial}\n${root}`)
  assert.deepEqual(program.ast.slice(0, 2), [
    ['dashboard', 'x', 'x'],
    ['machine', 'x', 'x']
  ])
  assert.deepEqual(
    program.ast.at(-1),
    ['start', ['machine-initial', 'machine-initial']])
  assert.equal(program.entry, root)
})

test('reports missing manifest, Root, and selected page sources', () => {
  assert.throws(
    () => assemble({}, '/graph-reduction'),
    /Missing page manifest: \/src\/pages\/pages\.lisp/)

  assert.throws(
    () => assemble(
      { '/src/pages/pages.lisp': pageManifest },
      '/graph-reduction'),
    /Missing root source: \/src\/root\.lisp/)

  assert.throws(
    () => assemble({
      '/src/pages/pages.lisp': pageManifest,
      '/src/root.lisp': root
    }, '/graph-reduction'),
    /Missing page source: \/src\/pages\/graph-reduction\/dashboard\.lisp/)
})
