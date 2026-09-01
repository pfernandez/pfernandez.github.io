import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  activeRoute,
  currentPage,
  currentRoute,
  normalizeRoute
} from './navigation.js'

test('normalizes route suffixes and selects the default route', () => {
  assert.equal(normalizeRoute('/graph-reduction///'), '/graph-reduction')
  assert.equal(normalizeRoute('/'), '/')
  assert.equal(activeRoute('/'), '/graph-reduction')
})

test('selects known pages and falls back to the default page', () => {
  assert.equal(
    currentPage('/graph-reduction/machine').source,
    '/src/pages/machine/machine.lisp')
  assert.equal(currentPage('/missing').route, '/graph-reduction')
})

test('reads the browser route when one exists', () => {
  const window = globalThis.window

  try {
    globalThis.window = { location: { pathname: '/graph-reduction/machine' } }
    assert.equal(currentRoute(), '/graph-reduction/machine')
  } finally {
    if (window === undefined) delete globalThis.window
    else globalThis.window = window
  }
})
