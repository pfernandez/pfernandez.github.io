import assert from 'node:assert/strict'
import { test } from 'node:test'
import { begin, focus, pending, run } from './reduce.js'
import { compile } from './compile.js'

const named = (legend, name) => [...legend]
  .find(([, entry]) => entry.name === name)?.[0]

const execute = source => {
  const { focus: expression, graph, legend } = compile(source)
  const origin = named(legend, 'Origin')
  return {
    graph,
    legend,
    result: run(begin(expression, origin), origin)
  }
}

test('connects and applies a unary identity definition', () => {
  const { legend, result } = execute(`
    ((Origin Origin)
     (I x x)
     (a a)
     (I a))
  `)

  assert.equal(focus(result.state), named(legend, 'a'))
})

test('retains lexical closure through nested unary definitions', () => {
  const { legend, result } = execute(`
    ((Origin Origin)
     (K x (K-y y x))
     (a a)
     (b b)
     ((K a) b))
  `)

  assert.equal(focus(result.state), named(legend, 'a'))
})

test('leaves composition to the contextual reducer', () => {
  const { legend, result } = execute(`
    ((Origin Origin)
     (K x (K-y y x))
     (S x (S-y y (S-z z ((x z) (y z)))))
     (a a)
     (((S K) K) a))
  `)

  assert.equal(focus(result.state), named(legend, 'a'))
})

test('lets a parameter shadow an outer spelling', () => {
  const { legend, result } = execute(`
    ((Origin Origin)
     (x x)
     (I x x)
     (a a)
     (I a))
  `)

  assert.equal(focus(result.state), named(legend, 'a'))
})

test('connects recursive references before walking a body', () => {
  const { focus, legend } = compile(`
    ((Origin Origin)
     (O x (x x))
     (O O))
  `)
  const O = named(legend, 'O')

  assert.equal(O[1][1][0], O[1][0])
  assert.equal(O[1][1][1], O[1][0])
  assert.equal(focus[0], O)
  assert.equal(focus[1], O)
})

test('observes an unapplied definition without entering its body', () => {
  const { legend } = compile(`
    ((Origin Origin)
     (I x x))
  `)
  const origin = named(legend, 'Origin')
  const I = named(legend, 'I')
  const state = begin(I, origin)

  assert.equal(pending(state), false)
  assert.equal(focus(state), I)
})

test('connects an imported capability as an existing identity', () => {
  const effect = value => value
  const { focus, legend } = compile('(effect argument)', { effect })

  assert.equal(legend.get(focus[0]).capability, effect)
  assert.equal(legend.get(focus[1]).name, 'argument')
})
