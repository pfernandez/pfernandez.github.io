import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view } from './device.js'

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

test('renders and revisits source-authored dashboard states', () => {
  const app = view(source)
  let rendered = app()

  assert.equal(rendered[1].class, 'dashboard-view')
  assert.equal(text(find(rendered, 'h2')), 'Graph Reduction')
  assert.deepEqual(graphs(rendered), ['seed', '(a (b c))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(a (b c))', '(b (c a))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(b (c a))', '(c (a b))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(c (a b))', '(a (b c))'])

  rendered = button(rendered, 'Next')[1].onclick()
  assert.deepEqual(graphs(rendered), ['(a (b c))', '(b (c a))'])
})

test('selects a preauthored appearance without leaving the graph', () => {
  const app = view(source)
  const rendered = app()
  const pastel = findAll(find(rendered, 'details'), 'button')[1]
  const updated = pastel[1].onclick()

  assert.equal(text(find(find(updated, 'details'), 'summary')), 'pastel')
  assert.deepEqual(graphs(updated), ['seed', '(a (b c))'])
})
