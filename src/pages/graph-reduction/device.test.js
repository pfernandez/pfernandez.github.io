import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { view as observe } from './device.js'
import { functions } from './functions.js'
import { include } from './graph/index.js'

const view = (source, imports = {}) =>
  observe(source, { ...functions, ...imports })

const files = Object.fromEntries(['dashboard', 'machine', 'site', 'root']
  .map(file => [
  `./${file}.lisp`,
  readFileSync(new URL(`./${file}.lisp`, import.meta.url), 'utf-8')
]))
const page = content => include(files['./root.lisp'], {
  ...files,
  './content.lisp': files[`./${content}.lisp`]
})
const source = page('dashboard')

const find = (node, tag) =>
  Array.isArray(node) && node[0] === tag
    ? node
    : Array.isArray(node)
      ? node.map(child => find(child, tag)).find(Boolean)
      : undefined

const findAll = (node, tag) =>
  !Array.isArray(node) ? []
    : [node[0] === tag ? [node] : [],
      ...node.map(child => findAll(child, tag))].flat()

const text = node =>
  Array.isArray(node)
    ? node.slice(2).map(text).join('')
    : typeof node === 'string' ? node : ''

const button = (node, label) =>
  findAll(node, 'button').find(node => text(node) === label)

const id = (node, value) =>
  findAll(node, 'div').find(node => node[1].id === value)

const dashboard = node =>
  findAll(node, 'div').find(node => node[1].class === 'dashboard-view')

const graphs = node => findAll(node, 'pre').map(text)

test('does not mistake sibling elements for properties', () => {
  assert.deepEqual(
    view('(div (text First) (text Second))'),
    ['div', {}, 'First', 'Second'])
})

test('retains an element with properties and no children', () => {
  assert.deepEqual(
    view('(button (props (disabled true)))'),
    ['button', { disabled: 'true' }])
})

test('keeps arbitrary properties local to each element', () => {
  assert.deepEqual(
    view(`
      (div
        (props (data-state first))
        (span (props (data-state second))))
    `),
    ['div', { 'data-state': 'first' },
      ['span', { 'data-state': 'second' }]])
})

test('treats text arguments as literal strings', () => {
  assert.equal(
    view('(text This web application is running within the machine)'),
    'This web application is running within the machine')
})

test('does not resolve visible identities inside text', () => {
  assert.equal(view('((web x x) (text web x))'), 'web x')
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
  const root = view(source, { route: '/graph-reduction' })

  assert.equal(root[0], 'html')
  assert.ok(find(root, 'head'))
  assert.ok(find(root, 'body'))
  assert.ok(find(root, 'main'))
  assert.ok(find(root, 'nav'))
  assert.ok(id(root, 'sidebar'))
  assert.ok(id(root, 'content'))
  assert.equal(text(find(root, 'title')), 'pfernandez.github.io')
  assert.equal(text(find(root, 'a')), 'Dashboard')
  assert.equal(find(root, 'a')[1].href, '/graph-reduction')
  assert.equal(find(root, 'a')[1].class, 'active')
  assert.equal(find(root, 'a')[1]['aria-current'], 'page')
  assert.equal(id(root, 'sidebar-panel')[1].class, 'sidebar-panel')
  assert.match(find(root, 'textarea')[1].value, /\(dashboard/)
  assert.match(find(root, 'textarea')[1].value, /\(site/)
  assert.match(find(root, 'textarea')[1].value, /\(root/)
})

test('renders another page through the shared Root', () => {
  const root = view(page('machine'), {
    route: '/graph-reduction/machine'
  })
  const links = findAll(root, 'a')

  assert.equal(text(find(root, 'p')),
               'This web application is running entirely within the machine '
               + 'it describes.')
  assert.equal(links[0][1].href, '/graph-reduction')
  assert.equal(links[1][1].href, '/graph-reduction/machine')
  assert.equal(links[1][1].class, 'active')
  assert.equal(links[1][1]['aria-current'], 'page')
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

  assert.ok(dashboard(rendered))
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

test('defers and repeats a fixed event action', () => {
  let calls = 0
  const rendered = observe(`
    ((fix x (fix x))
     (button
       (props
         (class action)
         (onclick (fix (effect Now))))
       Go))
  `, {
    ...functions,
    effect: ({ values }) => {
      calls += 1
      return values()[0]
    }
  })
  const action = button(rendered, 'Go')

  assert.equal(action[1].class, 'action')
  assert.equal(calls, 0)
  assert.equal(action[1].onclick(), 'Now')
  assert.equal(action[1].onclick(), 'Now')
  assert.equal(calls, 2)
})
