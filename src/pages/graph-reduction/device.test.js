import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'

test('reloads a prelinked view through worker state and browser events', () => {
  const source = readFileSync(new URL('./app.lisp', import.meta.url), 'utf-8')
  const NativeAlert = globalThis.alert
  const NativeWorker = globalThis.Worker
  const alerts = []
  const workers = []
  globalThis.alert = message => alerts.push(message)
  globalThis.Worker = class {
    constructor() {
      workers.push(this)
    }

    postMessage(message) {
      this.message = message
    }
  }

  try {
    const app = view(source)
    const rendered = app()
    const button = rendered[2]
    const worker = workers[0]

    assert.equal(rendered[0], 'div')
    assert.equal(button[0], 'button')
    assert.equal(button[2], 'Click me')
    assert.equal(typeof button[1].onclick, 'function')
    assert.ok(worker)
    assert.equal(worker.onmessage({ data: worker.message.focus })[0], 'div')
    button[1].onclick()
    assert.deepEqual(alerts, ['Hello component'])
  } finally {
    if (NativeAlert) globalThis.alert = NativeAlert
    else delete globalThis.alert
    if (NativeWorker) globalThis.Worker = NativeWorker
    else delete globalThis.Worker
  }
})
