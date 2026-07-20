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

const application = (legend, node, args = [], seen = new Set()) => {
  const symbol = nameOf(legend, node)
  return symbol
    ? { symbol, args }
    : Array.isArray(node) && !seen.has(node)
      ? (seen.add(node), application(legend, node[0], [node[1], ...args], seen))
      : { symbol, args }
}

const loopArgs = (legend, node) => {
  const frame = application(legend, node[0])
  return frame.symbol === 'Loop' && nameOf(legend, frame.args[0]) === 'Next'
    ? frame.args
    : []
}

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
    const loopRegister = node => {
      const [, register] = loopArgs(legend, node)
      const name = nameOf(legend, register)
      return registers.has(name) ? name : undefined
    }
    const values = []
    let state = graph

    for (let i = 0; i < 32; i += 1) {
      const register = loopRegister(state)
      if (register && register !== values.at(-1)) values.push(register)
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

  test('source-authored kernel moves cells through local banks', () => {
    const source = readFileSync(
      new URL('../link-kernel.lisp', import.meta.url),
      'utf8')
    const { graph, legend } = linked(source)
    const frames = []
    let state = graph

    for (let i = 0; i < 64; i += 1) {
      const [, kernel] = loopArgs(legend, state)
      const name = nameOf(legend, kernel)
      if (name && name !== frames.at(-1)) frames.push(name)
      state = step(state)
    }

    assert.deepEqual(
      frames.slice(0, 7),
      ['K0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K0'])
  })
})
