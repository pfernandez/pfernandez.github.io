import assert from 'node:assert/strict'
import { test } from 'node:test'
import { link } from './link.js'
import { next, observe } from './materialize.js'
import { project } from './project.js'

const named = (legend, name) => [...legend]
  .find(([, entry]) => entry.name === name)?.[0]

const observations = focus => {
  const visited = []
  observe(focus, graph => visited.push(graph))
  return visited
}

test('materializes finite source reduction before observation', () => {
  const linked = link(`
    ((Origin Origin)
     (I x x)
     (a a)
     (I a))
  `)
  const visited = observations(linked.focus)

  assert.equal(linked.graph[1], linked.focus)
  assert.equal(visited.at(-1), named(linked.legend, 'a'))
  assert.equal(linked.focus[1][1][1], linked.focus[1][1])
  assert.equal(Object.isFrozen(linked.graph), true)
  assert.equal('results' in linked, false)
  assert.equal('selections' in linked, false)
})

test('materializes lexical closure into a static orbit', () => {
  const linked = link(`
    ((Origin Origin)
     (K x (K-y y x))
     (a a)
     (b b)
     ((K a) b))
  `)

  assert.equal(
    observations(linked.focus).at(-1),
    named(linked.legend, 'a')
  )
})

test('materializes curried composition into a static orbit', () => {
  const linked = link(`
    ((Origin Origin)
     (K x (K-y y x))
     (S x (S-y y (S-z z ((x z) (y z)))))
     (a a)
     (((S K) K) a))
  `)

  assert.equal(
    observations(linked.focus).at(-1),
    named(linked.legend, 'a')
  )
})

test('ties a recurring reduction to its earlier observer frame', () => {
  const linked = link(`
    ((Origin Origin)
     (O x (x x))
     (O O))
  `)
  const first = linked.focus
  const definition = first[1]
  const body = definition[1]

  assert.equal(body[1], definition)
  assert.deepEqual(observations(first), [
    first[0],
    definition[0],
    body[0]
  ])
})

test('links source to one recurrent device observation', () => {
  const effect = value => value
  const linked = link(`
    ((Origin Origin)
     (argument argument)
     (effect argument))
  `, { effect })
  let current = linked.focus

  while (next(current) !== current) current = next(current)

  assert.equal(project(current, linked.legend), current[0][1])
  assert.equal(linked.legend.get(current[0][0]).capability, effect)
})
