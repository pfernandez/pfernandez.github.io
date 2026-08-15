import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'

test('selects a prelinked view through a browser event', () => {
  const source = readFileSync(new URL('./app.lisp', import.meta.url), 'utf-8')
  const NativeAlert = globalThis.alert
  const alerts = []
  globalThis.alert = message => alerts.push(message)

  try {
    const app = view(source)
    const rendered = app()
    const button = rendered[2]

    assert.equal(rendered[0], 'div')
    assert.equal(button[0], 'button')
    assert.equal(button[2], 'Click me')
    assert.equal(typeof button[1].onclick, 'function')
    button[1].onclick()
    assert.deepEqual(alerts, ['Hello component'])
  } finally {
    if (NativeAlert) globalThis.alert = NativeAlert
    else delete globalThis.alert
  }
})
