import assert from 'node:assert/strict'
import { test } from 'node:test'
import { relay } from './relay.js'

test('relays graph addresses from an isolated runner', () => {
  const NativeWorker = globalThis.Worker
  const workers = []

  globalThis.Worker = class {
    constructor(url, options) {
      this.url = url
      this.options = options
      workers.push(this)
    }

    postMessage(message) {
      this.message = message
    }
  }

  try {
    const bytes = Uint8Array.of(0, 0, 0, 0, 8, 0, 0, 0)
    const addresses = []
    const worker = relay({ bytes, focus: 0, ignored: true },
                         address => addresses.push(address))

    assert.equal(worker, workers[0])
    assert.equal(worker.url.pathname.endsWith('/wasm/worker.js'), true)
    assert.deepEqual(worker.options, { type: 'module' })
    assert.deepEqual(worker.message, { bytes, focus: 0 })

    worker.onmessage({ data: 0 })
    worker.onmessage({ data: 8 })
    assert.deepEqual(addresses, [0, 8])
  } finally {
    if (NativeWorker) globalThis.Worker = NativeWorker
    else delete globalThis.Worker
  }
})
