import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { manifest } from './manifest.js'

const source = readFileSync(
  new URL('./pages.lisp', import.meta.url), 'utf-8')

test('reads the authored site manifest as host data', () => {
  assert.deepEqual(manifest(source), {
    title: 'pfernandez.github.io',
    pages: [{
      path: 'graph-reduction',
      summary: 'Graph Reduction',
      items: [{
        label: 'Dashboard',
        route: '/graph-reduction',
        source: '/src/pages/graph-reduction/dashboard.lisp',
        default: true
      }, {
        label: 'Machine',
        route: '/graph-reduction/machine',
        source: '/src/pages/machine/machine.lisp'
      }]
    }]
  })
})

test('requires one site definition', () => {
  assert.throws(
    () => manifest('((include page.lisp))'),
    /Missing site manifest/)
})
