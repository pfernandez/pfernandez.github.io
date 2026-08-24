import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view as observe } from './device.js'
import { functions } from './functions.js'
import { include } from './graph/index.js'

const view = source => observe(source, functions)

const files = Object.fromEntries(['dashboard', 'root'].map(file => [
  `./${file}.lisp`,
  readFileSync(new URL(`./${file}.lisp`, import.meta.url), 'utf-8')
]))
const source = include(files['./root.lisp'], files)

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

test('displays the labels of named graph pairs', () => {
  assert.equal(
    text(view('(serialize (step before after) plain)')),
    '(step before after)')
})

test('displays imported functions by their authored names', () => {
  assert.equal(text(view('(serialize div plain)')), 'div')
})

test('authors the complete document from Root', () => {
  const root = view(source)

  assert.equal(root[0], 'html')
  assert.ok(find(root, 'head'))
  assert.ok(find(root, 'body'))
  assert.equal(text(find(root, 'title')), 'pfernandez.github.io')
  assert.match(find(root, 'textarea')[1].value, /\(dashboard/)
  assert.match(find(root, 'textarea')[1].value, /\(root/)
})

test('renders the value after a private definition sequence', () => {
  const rendered = view(`
    ((observe message
       ((identity x x)
        (div message)))
     (component (observe Hello)))
  `)

  assert.deepEqual(rendered, ['div', {}, 'Hello'])
})

test('recurs through one uniform observer state', () => {
  let rendered = view(`
    ((root (origin first second)
       ((observe ((history focus) next)
          (div
            (button
              (onclick (observe ((focus next) history)))
              Next)
            (serialize history ink)
            (serialize focus ink)))
        (observe ((origin first) second))))
     (component (root (C A B))))
  `)

  assert.deepEqual(graphs(rendered), ['(C A B)', 'A'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['A', 'B'])
})

test('renders and revisits source-authored observer states', () => {
  let rendered = view(source)

  assert.equal(find(rendered, 'div')[1].class, 'dashboard-view')
  assert.equal(text(find(rendered, 'h2')), 'Graph Reduction')
  assert.deepEqual(graphs(rendered), ['(A B C)', 'B'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['B', 'C'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['C', '(A B C)'])

  rendered = button(rendered, 'Reset')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(A B C)', 'B'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['B', 'C'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['C', '(A B C)'])
})

test('selects a preauthored appearance without leaving the graph', () => {
  const rendered = view(source)
  const pastel = findAll(find(rendered, 'details'), 'button')[1]
  const updated = pastel[1].onclick()

  assert.equal(text(find(find(updated, 'details'), 'summary')), 'pastel')
  assert.deepEqual(graphs(updated), ['(A B C)', 'B'])
})

test('carries a completed application identity through an event', () => {
  const initial = view(`
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
  const advanced = button(initial, 'Next')[1].onclick()
  const restored = button(advanced, 'Undo')[1].onclick()

  assert.equal(text(find(initial, 'p')), 'Before')
  assert.equal(text(find(advanced, 'p')), 'After')
  assert.equal(text(find(restored, 'p')), 'Before')
})
