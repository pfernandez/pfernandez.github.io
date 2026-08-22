import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'

const source = readFileSync(
  new URL('./observe.lisp', import.meta.url), 'utf-8')

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

test('renders the value after a private definition sequence', () => {
  const app = view(`
    ((observe message
       ((identity x x)
        (div message)))
     (component (observe Hello)))
  `)

  assert.deepEqual(app(), ['div', {}, 'Hello'])
})

test('renders and revisits source-authored observer states', () => {
  const app = view(source)
  let rendered = app()

  assert.equal(rendered[1].class, 'dashboard-view')
  assert.equal(text(find(rendered, 'h2')), 'Graph Reduction')
  assert.deepEqual(graphs(rendered), ['(C (A B))', '(A (B C))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(A (B C))', '(B (C A))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(B (C A))', '(C (A B))'])

  rendered = button(rendered, 'Reset')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(C (A B))', '(A (B C))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(A (B C))', '(B (C A))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(B (C A))', '(C (A B))'])
})

test('selects a preauthored appearance without leaving the graph', () => {
  const app = view(source)
  const rendered = app()
  const pastel = findAll(find(rendered, 'details'), 'button')[1]
  const updated = pastel[1].onclick()

  assert.equal(text(find(find(updated, 'details'), 'summary')), 'pastel')
  assert.deepEqual(graphs(updated), ['(C (A B))', '(A (B C))'])
})

test('carries a completed application identity through an event', () => {
  const app = view(`
    ((after history
       (div
         (button (onclick history) Undo)
         (p After)))
     (before message
       (div
         (button
           (onclick (after (before message)))
           Next)
         (p message)))
     (component (before Before)))
  `)
  const initial = app()
  const advanced = button(initial, 'Next')[1].onclick()
  const restored = button(advanced, 'Undo')[1].onclick()

  assert.equal(text(find(initial, 'p')), 'Before')
  assert.equal(text(find(advanced, 'p')), 'After')
  assert.equal(text(find(restored, 'p')), 'Before')
})
