import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'

test('reloads a prelinked view through worker state and browser events', () => {
  const source = readFileSync(new URL('./app.lisp', import.meta.url), 'utf-8')
  const NativeWorker = globalThis.Worker
  const workers = []
  globalThis.Worker = class {
    constructor() {
      workers.push(this)
    }

    postMessage(message) {
      this.message = message
    }

    terminate() {
      this.terminated = true
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
    assert.equal(rendered[3][2], 'Hello-world')
    assert.equal(typeof button[1].onclick, 'function')
    assert.ok(worker)
    const memory = new DataView(worker.message.bytes.buffer)
    assert.equal(memory.getUint32(worker.message.focus, true),
                 worker.message.focus)

    button[1].onclick()
    const next = workers[1]
    const application = next.message.focus
    const result = memory.getUint32(application, true)

    assert.equal(worker.terminated, true)
    const updated = next.onmessage({ data: result })
    assert.equal(updated[0], 'div')
    assert.equal(updated[3][2], 'Hello-component')
  } finally {
    if (NativeWorker) globalThis.Worker = NativeWorker
    else delete globalThis.Worker
  }
})
