import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { link } from './link.js'
import { serialize } from './serialize.js'

const step = pair =>
  pair[1]

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

const nameOf = (legend, node) =>
  legend.find(entry => entry.node === node)?.symbol

const steps = (graph, count) =>
  count === 0 ? graph : steps(step(graph), count - 1)

const program = (definitions, expression) =>
  `(${definitions.join('\n')} ${expression})`

const I = '(I x x)'
const K = '(K x y x)'
const S = '(S x y z ((x z) (y z)))'
const Y = '(Y f (f (Y f)))'

describe('pair-local link experiment', () => {
  test('links combinator calls as right-edge steps', () => {
    const { graph, legend } = linked(program([I, K, S], '(S a b c)'))

    assert.equal(
      serialize(steps(graph, 2), { legend }),
      '((a c) (b c))')
  })

  test('ties recursive calls into a finite step orbit', () => {
    const { graph } = linked(program([I, Y], '(Y I)'))
    const second = steps(graph, 2)
    const fourth = steps(graph, 4)

    assert.equal(steps(fourth, 1), second)
  })

  test('source-authored counter advances at loop boundaries', () => {
    const source = readFileSync(
      new URL('../link-counter.lisp', import.meta.url),
      'utf8')
    const { graph, legend } = linked(source)
    const registers = new Set(['B00', 'B01', 'B10', 'B11'])
    const loopRegister = node =>
      nameOf(legend, node[0]?.[0]?.[0]) === 'Loop'
          && registers.has(nameOf(legend, node[0][1]))
        ? nameOf(legend, node[0][1])
        : undefined
    const values = []
    let state = graph

    for (let i = 0; i < 32; i += 1) {
      const register = loopRegister(state)
      if (register) values.push(register)
      state = step(state)
    }

    assert.deepEqual(values.slice(0, 5), [
      'B00',
      'B01',
      'B10',
      'B11',
      'B00'
    ])
  })
})
