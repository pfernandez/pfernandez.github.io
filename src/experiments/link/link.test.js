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

test('() refers to its enclosing pair', () => {
  const alert = () => undefined
  const { graph, legend } = compile(
    '(onclick (() (alert Hello)))',
    { onclick: 'onclick', alert })
  const continuation = graph[1]

  assert.equal(continuation[0], continuation)
  assert.equal(legend.has(continuation), false)
  assert.equal(legend.get(continuation[1][0]).capability, alert)
  assert.equal(legend.get(continuation[1][1]).name, 'Hello')
})

test('a deferred frame can carry a named continuation', () => {
  const alert = () => undefined
  const { graph, legend } = compile(
    '((hello (alert Hello)) (onclick (() hello)))',
    { onclick: 'onclick', alert })
  const hello = graph[0]
  const continuation = graph[1][1]

  assert.equal(hello[0], hello)
  assert.equal(legend.get(hello).name, 'hello')
  assert.equal(continuation[0], continuation)
  assert.equal(continuation[1], hello)
})
