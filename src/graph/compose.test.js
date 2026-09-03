import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose } from './compose.js'
import { connect } from './connect.js'
import { decompose } from './decompose.js'
import { parse } from './parse.js'

const composed = (source, imports) =>
  compose(connect(decompose(parse(source)), imports))

test('builds a fresh graph without changing connected identities', () => {
  const connected = connect(decompose(parse('((I x x) (I a))')))
  const input = connected.definitions.get(connected.graph[0]).input
  const argument = connected.graph[1][1]
  const composed = compose(connected)

  assert.notEqual(composed.graph, connected.graph)
  assert.notEqual(composed.graph[0], connected.graph[0])
  assert.equal(input.length, 1)
  assert.equal(input[0], input)
  assert.equal(argument.length, 1)
  assert.equal(argument[0], argument)
})

test('composes identity without resolving another symbol', () => {
  const { focus, result, legend } = composed('((I x x) (I a))')

  assert.equal(legend.get(focus[0]).name, 'a')
  assert.equal(focus[1], focus[0])
  assert.equal(result, focus[1])
})

test('composes shared argument identities', () => {
  const { focus } = composed(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c)))
  `)
  const [args, result] = focus

  assert.equal(result[0][0], args)
  assert.equal(result[0][1], args[1])
  assert.equal(result[1][0], args[0])
  assert.equal(result[1][1], args[1])
})

test('reuses the result identity of a named application', () => {
  const { focus, legend } = composed(`
    ((I x x)
     (first (I a))
     (pair (x y) (x y))
     (pair (first first)))
  `)
  const [args, result] = focus

  assert.equal(legend.get(args[0]).name, 'a')
  assert.equal(args[0], args[1])
  assert.equal(result[0], args[0])
  assert.equal(result[1], args[1])
})

test('retains application of a foreign result for projection', () => {
  const make = () => {}
  const { focus, legend } = composed('((make x) y)', { make })

  assert.equal(legend.get(focus[0][0]).capability, make)
  assert.equal(legend.get(focus[0][1]).name, 'x')
  assert.equal(legend.get(focus[1]).name, 'y')
})

test('ties recurring definition and argument identities', () => {
  const { focus, legend } = composed(`
    ((fix x (fix x))
     (fix a))
  `)

  assert.equal(legend.get(focus[0]).name, 'a')
  assert.equal(focus[1], focus)
})
