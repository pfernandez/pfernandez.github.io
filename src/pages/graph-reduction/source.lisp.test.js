import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { compile, serialize } from './graph/index.js'
import { observe } from './observer/observe.js'

const source = readFileSync(new URL('./source.lisp', import.meta.url), 'utf8')
const finalExpression = '(((S a) b) c)'

const program = expression =>
  source.replace(new RegExp(`\\n${finalExpression.replace(/[()]/g, '\\$&')}\\s*$`),
                 `\n${expression}\n`)

const hasGraph = value =>
  value && typeof value === 'object' && Object.hasOwn(value, 'graph')

const graphOf = value => hasGraph(value) ? value.graph : value
const sequenceOf = value => hasGraph(value) ? value.sequence : []
const crossingsOf = value => hasGraph(value) ? value.crossings ?? [] : []

const observeUntilStable = (term, remaining = 1024) => {
  const graph = graphOf(term)
  const next = observe(graph)
  if (next === graph) return term
  if (remaining <= 0) throw new Error('Expression did not settle')
  return observeUntilStable({ graph: next,
                              sequence: sequenceOf(term),
                              crossings: crossingsOf(term) },
                            remaining - 1)
}

const assertDoesNotSettle = term =>
  assert.throws(() => observeUntilStable(term, 128), /did not settle/i)

const settle = expression =>
  serialize(graphOf(observeUntilStable(compile(program(expression)))),
            sequenceOf(compile(program(expression))),
            crossingsOf(compile(program(expression))))

const assertExposesEqual = (left, right) =>
  assert.equal(settle(left), settle(right), `${left} = ${right}`)

describe('source.lisp examples', () => {
  test('Z keeps recursive state updates live', () => {
    const expr = program(`
      (defn STEP (self state) (self (state tick)))
      ((Z STEP) seed)
    `)
    assertDoesNotSettle(compile(expr))
  })

  test('Z can return state and settle', () =>
    assert.equal(settle(`
      (defn DONE (self state) state)
      ((Z DONE) seed)
    `), 'seed'))

  test('Y I stays live without state', () =>
    assertDoesNotSettle(compile(program('(Y I)'))))

  test('applied Y I keeps its argument visible', () =>
    assertDoesNotSettle(compile(program('(def y (Y I))\n(y a)'))))

  test('Z can carry state unchanged without settling', () =>
    assertDoesNotSettle(compile(program(`
      (defn HOLD (self state) (self state))
      ((Z HOLD) seed)
    `))))

  test('Try expression (((pair a) b) left) reaches a', () =>
    assert.equal(settle('(((pair a) b) left)'), 'a'))

  test('Try expression ((((add one) two) f) x) reaches (f (f (f x)))', () =>
    assert.equal(settle('((((add one) two) f) x)'), '(f (f (f x)))'))
})
