import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'
import { leftAddress, rightAddress } from './wasm/address.js'

const source = readFileSync(new URL('./app.lisp', import.meta.url), 'utf-8')

const find = (node, tag) =>
  Array.isArray(node) && node[0] === tag
    ? node
    : Array.isArray(node)
      ? node.map(child => find(child, tag)).find(Boolean)
      : undefined

const text = node =>
  Array.isArray(node)
    ? node.slice(2).map(text).join('')
    : typeof node === 'string' ? node : ''

const withWorkers = run => {
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
    run(workers)
  } finally {
    if (NativeWorker) globalThis.Worker = NativeWorker
    else delete globalThis.Worker
  }
}

test('selects a preauthored dashboard state from an authored alphabet', () => {
  withWorkers(workers => {
    const app = view(source)
    const rendered = app()
    const menu = find(rendered, 'select')
    const textarea = find(rendered, 'textarea')
    const before = workers[0].message.bytes.slice()

    assert.equal(rendered[1].class, 'dashboard')
    assert.equal(text(find(rendered, 'h2')), 'Graph Reduction')
    assert.equal(textarea[1].value, source)
    assert.equal(menu[1].value, 'ink')
    assert.equal(text(find(rendered, 'pre')), '(a b)')
    assert.throws(
      () => menu[1].onchange('unknown'),
      /Unknown authored input identity: unknown/)

    menu[1].onchange('pastel')
    const first = workers[1]
    const memory = new DataView(first.message.bytes.buffer)
    const firstApplication = first.message.focus
    const firstArgs = leftAddress(memory, firstApplication)
    const firstState = leftAddress(memory, firstArgs)
    const current = leftAddress(memory, firstState)
    const pastel = rightAddress(memory, firstState)
    const result = rightAddress(memory, firstApplication)
    const updated = first.onmessage({ data: result })
    const nextMenu = find(updated, 'select')

    assert.equal(workers[0].terminated, true)
    assert.equal(firstApplication % 8, 4)
    assert.equal(nextMenu[1].value, 'pastel')
    assert.equal(text(find(updated, 'pre')), '(a b)')
    assert.deepEqual(first.message.bytes, before)

    nextMenu[1].onchange('color')
    const second = workers[2]
    const secondApplication = second.message.focus
    const secondArgs = leftAddress(memory, secondApplication)
    const secondState = leftAddress(memory, secondArgs)

    assert.equal(leftAddress(memory, secondState), current)
    assert.notEqual(rightAddress(memory, secondState), pastel)
    assert.deepEqual(second.message.bytes, before)
  })
})

test('retains direct authored event transitions', () => {
  withWorkers(workers => {
    const app = view(`
      ((fix x (fix x))
       (app message
            (fix
              (button
                (onclick (app After))
                (text message))))
       (component (app Before)))
    `)
    const button = app()

    assert.equal(text(button), 'Before')
    button[1].onclick()
    const worker = workers[1]
    const memory = new DataView(worker.message.bytes.buffer)
    const result = rightAddress(memory, worker.message.focus)
    const updated = worker.onmessage({ data: result })

    assert.equal(text(updated), 'After')
  })
})
