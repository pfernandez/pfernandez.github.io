import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { decompose } from '../../graph/decompose.js'
import { parse } from '../../graph/parse.js'
import { link } from './link.js'

const source = readFileSync(
  new URL('./observer.lisp', import.meta.url),
  'utf8'
)

const named = ({ graph, legend }, identities = new Map(), seen = new Set()) => {
  if (seen.has(graph)) return identities
  seen.add(graph)

  const name = legend.get(graph)?.name
  if (name) identities.set(name, graph)
  graph.forEach(node => named({ graph: node, legend }, identities, seen))

  return identities
}

const compile = source => link(decompose(parse(source)))

test('carries an application binding entirely as graph identities', () => {
  const identities = named(compile(source))
  const I = identities.get('I')
  const x = identities.get('x')
  const A = identities.get('A')
  const environment = identities.get('Environment')[1]
  const application = identities.get('Application')[1]
  const entered = identities.get('Entered')[1]
  const returned = identities.get('Returned')[1]

  assert.deepEqual(I[1], [x, x])
  assert.deepEqual(application, [I, A])
  assert.deepEqual(environment, [identities.get('Empty'), [x, A]])
  assert.deepEqual(entered, [identities.get('Environment'), x])
  assert.deepEqual(returned, [identities.get('Environment'), A])
  assert.equal(returned[1], A)
})

test('a right-only observer visits the preauthored states and returns', () => {
  const identities = named(compile(source))
  const observer = identities.get('Observer')
  const states = [observer]

  for (let i = 0; i < 3; i += 1) states.push(states.at(-1)[1])

  assert.deepEqual(states.map(state => state[0]), [
    observer,
    identities.get('Application'),
    identities.get('Entered'),
    identities.get('Returned')
  ])
  assert.equal(states.at(-1)[1], observer)
})
