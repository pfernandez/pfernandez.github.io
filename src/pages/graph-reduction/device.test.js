import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'
import { leftAddress, rightAddress } from './wasm/address.js'

const source = readFileSync(
  new URL('./dashboard.lisp', import.meta.url), 'utf-8')

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

const button = (node, label) =>
  findAll(node, 'button').find(node => text(node) === label)

const graphs = node => findAll(node, 'pre').map(text)

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

    assert.equal(rendered[1].class, 'dashboard-view')
    assert.equal(text(find(rendered, 'h2')), 'Graph Reduction')
    assert.equal(textarea[1].value, source)
    assert.equal(text(find(menu, 'summary')), 'ink')
    assert.deepEqual(graphs(rendered), ['seed', '(a (b c))'])

    findAll(menu, 'button')[1][1].onclick()
    const first = workers[1]
    const memory = new DataView(first.message.bytes.buffer)
    const firstApplication = first.message.focus
    const firstArgs = leftAddress(memory, firstApplication)
    const firstWindow = leftAddress(memory, firstArgs)
    const history = leftAddress(memory, firstWindow)
    const frame = rightAddress(memory, firstWindow)
    const focus = leftAddress(memory, frame)
    const next = rightAddress(memory, frame)
    const pastel = rightAddress(memory, firstArgs)
    const result = rightAddress(memory, firstApplication)
    const updated = first.onmessage({ data: result })
    const nextMenu = find(updated, 'details')

    assert.equal(workers[0].terminated, true)
    assert.equal(firstApplication % 8, 4)
    assert.equal(text(find(nextMenu, 'summary')), 'pastel')
    assert.deepEqual(graphs(updated), ['seed', '(a (b c))'])
    assert.deepEqual(first.message.bytes, before)

    findAll(nextMenu, 'button')[2][1].onclick()
    const second = workers[2]
    const secondApplication = second.message.focus
    const secondArgs = leftAddress(memory, secondApplication)
    const secondWindow = leftAddress(memory, secondArgs)
    const secondFrame = rightAddress(memory, secondWindow)

    assert.equal(leftAddress(memory, secondWindow), history)
    assert.equal(leftAddress(memory, secondFrame), focus)
    assert.equal(rightAddress(memory, secondFrame), next)
    assert.notEqual(rightAddress(memory, secondArgs), pastel)
    assert.deepEqual(second.message.bytes, before)
  })
})

test('follows three source-authored states through recursion', () => {
  withWorkers(workers => {
    const app = view(source)
    const rendered = app()
    const before = workers[0].message.bytes.slice()

    assert.equal(text(rendered).includes('Steps:'), false)

    button(rendered, 'Next')[1].onclick()
    const first = workers[1]
    const memory = new DataView(first.message.bytes.buffer)
    const firstArgs = leftAddress(memory, first.message.focus)
    const firstWindow = leftAddress(memory, firstArgs)
    const firstFrame = rightAddress(memory, firstWindow)
    const updated = first.onmessage({
      data: rightAddress(memory, first.message.focus)
    })

    assert.deepEqual(graphs(updated), ['(a (b c))', '(b (c a))'])
    assert.equal(text(find(find(updated, 'details'), 'summary')), 'ink')
    assert.deepEqual(first.message.bytes, before)

    button(updated, 'Next')[1].onclick()
    const second = workers[2]
    const secondArgs = leftAddress(memory, second.message.focus)
    const secondWindow = leftAddress(memory, secondArgs)
    const thirdView = second.onmessage({
      data: rightAddress(memory, second.message.focus)
    })

    assert.equal(
      leftAddress(memory, secondWindow),
      leftAddress(memory, firstFrame))
    assert.equal(
      rightAddress(memory, secondWindow),
      rightAddress(memory, firstFrame))
    assert.deepEqual(graphs(thirdView), ['(b (c a))', '(c (a b))'])

    button(thirdView, 'Next')[1].onclick()
    const third = workers[3]
    const cycled = third.onmessage({
      data: rightAddress(memory, third.message.focus)
    })

    assert.deepEqual(graphs(cycled), ['(c (a b))', '(a (b c))'])

    button(cycled, 'Next')[1].onclick()
    const repeated = workers[4]
    const repeatedView = repeated.onmessage({
      data: rightAddress(memory, repeated.message.focus)
    })

    assert.deepEqual(
      graphs(repeatedView), ['(a (b c))', '(b (c a))'])

    button(repeatedView, 'Next')[1].onclick()
    const closed = workers[5]

    assert.equal(closed.message.focus, second.message.focus)
    assert.deepEqual(closed.message.bytes, before)
    assert.equal(button(cycled, 'Undo')[1].disabled, 'true')
    assert.equal(button(cycled, 'Reset')[1].disabled, 'true')
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

test('returns to an authored application retained as history', () => {
  withWorkers(workers => {
    const app = view(`
      ((fix x (fix x))
       (after history
         (fix
           (div
             (button (onclick history) Undo)
             (p After))))
       (before message
         (fix
           (div
             (button
               (onclick (after (before message)))
               Next)
             (p message))))
       (component (before Before)))
    `)
    const initial = app()
    const bytes = workers[0].message.bytes.slice()

    button(initial, 'Next')[1].onclick()
    const forward = workers[1]
    const memory = new DataView(forward.message.bytes.buffer)
    const history = leftAddress(memory, forward.message.focus)
    const advanced = forward.onmessage({
      data: rightAddress(memory, forward.message.focus)
    })

    assert.equal(text(find(advanced, 'p')), 'After')

    button(advanced, 'Undo')[1].onclick()
    const backward = workers[2]
    const restored = backward.onmessage({
      data: rightAddress(memory, backward.message.focus)
    })

    assert.equal(backward.message.focus, history)
    assert.equal(text(find(restored, 'p')), 'Before')
    assert.deepEqual(backward.message.bytes, bytes)
  })
})
