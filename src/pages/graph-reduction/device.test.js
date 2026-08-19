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

const findAll = (node, tag) =>
  !Array.isArray(node) ? []
    : node[0] === tag ? [node]
      : node.flatMap(child => findAll(child, tag))

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

test('does not mistake sibling elements for properties', () => {
  assert.deepEqual(
    view('(div (text First) (text Second))'),
    ['div', {}, 'First', 'Second'])
})

test('retains an element with properties and no children', () => {
  assert.deepEqual(
    view('(button (disabled true))'),
    ['button', { disabled: 'true' }])
})

test('chooses a preauthored dashboard state with authored events', () => {
  withWorkers(workers => {
    const app = view(source)
    const rendered = app()
    const menu = find(rendered, 'details')
    const textarea = find(rendered, 'textarea')
    const before = workers[0].message.bytes.slice()

    assert.equal(rendered[1].class, 'dashboard')
    assert.equal(text(find(rendered, 'h2')), 'Graph Reduction')
    assert.equal(textarea[1].value, source)
    assert.equal(text(find(menu, 'summary')), 'ink')
    assert.equal(text(find(rendered, 'pre')), '(a b)')

    findAll(menu, 'button')[1][1].onclick()
    const first = workers[1]
    const memory = new DataView(first.message.bytes.buffer)
    const firstApplication = first.message.focus
    const firstState = leftAddress(memory, firstApplication)
    const current = leftAddress(memory, firstState)
    const pastel = rightAddress(memory, firstState)
    const result = rightAddress(memory, firstApplication)
    const updated = first.onmessage({ data: result })
    const nextMenu = find(updated, 'details')

    assert.equal(workers[0].terminated, true)
    assert.equal(firstApplication % 8, 4)
    assert.equal(text(find(nextMenu, 'summary')), 'pastel')
    assert.equal(text(find(updated, 'pre')), '(a b)')
    assert.deepEqual(first.message.bytes, before)

    findAll(nextMenu, 'button')[2][1].onclick()
    const second = workers[2]
    const secondApplication = second.message.focus
    const secondState = leftAddress(memory, secondApplication)

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
