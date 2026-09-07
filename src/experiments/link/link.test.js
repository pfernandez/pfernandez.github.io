import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decompose } from '../../graph/decompose.js'
import { parse } from '../../graph/parse.js'
import { link } from './link.js'

const compile = (source, imports) =>
  link(decompose(parse(source)), imports)

test('closes a lone name into one fixed identity', () => {
  const { graph, legend } = compile('x')

  assert.equal(graph[0], graph)
  assert.equal(graph[1], graph)
  assert.equal(legend.get(graph).name, 'x')
})

test('a fresh left name identifies its enclosing pair', () => {
  const { graph, legend } = compile('((a b) a)')
  const a = graph[0]

  assert.equal(a[0], a)
  assert.equal(graph[1], a)
  assert.equal(legend.get(a).name, 'a')
  assert.equal(legend.get(a[1]).name, 'b')
})

test('connects imported functions as ordinary shared identities', () => {
  const show = () => undefined
  const { graph, legend } = compile('(show value)', { show })

  assert.equal(legend.get(graph[0]).capability, show)
  assert.equal(legend.get(graph[1]).name, 'value')
  assert.equal(graph[0][0], graph[0])
  assert.equal(graph[0][1], graph[0])
})
