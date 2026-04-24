import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { observe } from './observer/observe.js'
import { compile, serialize } from './graph/index.js'

const source = readFileSync(new URL('./source.lisp', import.meta.url), 'utf8')
const finalExpression = '(((S a) b) c)'

const definitionCases =
  [
    ['I', '(I a)', 'a'],
    ['id', '(id a)', 'a'],
    ['K', '((K a) b)', 'a'],
    ['const', '((const a) b)', 'a'],
    ['S', '(((S a) b) c)', '((a c) (b c))'],
    ['spread', '(((spread a) b) c)', '((a c) (b c))'],
    ['B', '(((B f) g) x)', '(f (g x))'],
    ['compose', '(((compose f) g) x)', '(f (g x))'],
    ['C', '(((C f) x) y)', '((f y) x)'],
    ['flip', '(((flip f) x) y)', '((f y) x)'],
    ['W', '((W f) x)', '((f x) x)'],
    ['split', '((split f) x)', '((f x) x)'],
    ['true', '((true a) b)', 'a'],
    ['false', '((false a) b)', 'b'],
    ['if', '(((if p) th) el)', '((p th) el)'],
    ['not', '(((not p) x) y)', '((p y) x)'],
    ['and', '((((and p) q) x) y)', '((p ((q x) y)) y)'],
    ['or', '((((or p) q) x) y)', '((p x) ((q x) y))'],
    ['pair', '(((pair a) b) f)', '((f a) b)'],
    ['first', '(first p)', '(p true)'],
    ['second', '(second p)', '(p false)'],
    ['curry', '(((curry f) x) y)', '(f ((pair x) y))'],
    ['uncurry', '((uncurry f) p)', '((f (p true)) (p false))'],
    ['left', '((left x) y)', 'x'],
    ['right', '((right x) y)', 'y'],
    ['self', '(self x)', 'x'],
    ['zero', '((zero f) x)', 'x'],
    ['one', '((one f) x)', '(f x)'],
    ['two', '((two f) x)', '(f (f x))'],
    ['succ', '(((succ n) f) x)', '(f ((n f) x))'],
    ['add', '((((add m) n) f) x)', '((m f) ((n f) x))'],
    ['mul', '((((mul m) n) f) x)', '((m (n f)) x)'],
    ['is-zero', '(is-zero n)', '((n (K false)) true)'],
    ['APPLY-SELF', '((APPLY-SELF x) v)', '((x x) v)'],
    ['apply-self', '((apply-self x) v)', '((x x) v)'],
    ['THETA', '((THETA f) x)', '(f (APPLY-SELF x))'],
    ['theta', '((theta f) x)', '(f (APPLY-SELF x))'],
    ['Y-THETA', '((Y-THETA f) x)', '(f (x x))'],
    ['Y', '(Y f)', '(f 0)'],
    ['Z', '(Z f)', '(f (APPLY-SELF (THETA f)))'],
    ['fix', '(fix f)', '(f (APPLY-SELF (THETA f)))']
  ]

const tryCases =
  [
    ['(((S a) b) c)', '((a c) (b c))'],
    ['(((pair a) b) left)', 'a'],
    ['((((add one) two) f) x)', '(f (f (f x)))'],
    ['((I a) b)', '(a b)']
  ]

const program = expression =>
  source.replace(new RegExp(`\\n${finalExpression.replace(/[()]/g, '\\$&')}\\s*$`),
                 `\n${expression}\n`)

const namesInSource = () =>
  [...source.matchAll(/^\((?:defn|def)\s+([^\s()]+)/gm)]
    .map(match => match[1])
    .sort()

const tryExpressions = () =>
  [...source.matchAll(/^; (\(+.*\))$/gm)].map(match => match[1])

const observeUntilStable = (term, remaining = 64) => {
  const next = observe(term)
  if (next === term) return term
  if (remaining <= 0) throw new Error('Expression did not settle')
  return observeUntilStable(next, remaining - 1)
}

const serializeSteps = (term, remaining = 64) => {
  const next = observe(term)
  if (next === term) return [serialize(term)]
  if (remaining <= 0) throw new Error('Expression did not settle')
  return [serialize(term), ...serializeSteps(next, remaining - 1)]
}

const serializeTicks = (term, count) =>
  count <= 0 ? [] : [serialize(term),
                     ...serializeTicks(observe(term), count - 1)]

const assertDoesNotSettle = term =>
  assert.throws(() => observeUntilStable(term, 32), /did not settle/i)

const settle = expression =>
  serialize(observeUntilStable(compile(program(expression))))

const apply = (fn, arg = 'a') =>
  `(${fn} ${arg})`

const assertExposesEqual = (left, right) =>
  assert.equal(settle(left), settle(right), `${left} = ${right}`)

const assertActsEqual = (left, right, arg = 'a') =>
  assertExposesEqual(apply(left, arg), apply(right, arg))

describe('source.lisp examples', () => {
  test('source.lisp defines every expected name', () =>
    assert.deepEqual(definitionCases.map(([name]) => name).sort(),
                     namesInSource()))

  test('the empty boundary and I act the same', () => {
    assert.equal(serialize(compile(program('I'))), '()')
    assertExposesEqual('()', 'I')
    assertExposesEqual('I', 'id')
    assertActsEqual('()', 'I')
    assertActsEqual('I', 'id')
  })

  test('S K K acts as identity', () => {
    assert.equal(settle(apply('I')), 'a')
    assertActsEqual('I', '((S K) K)')
  })

  test('source.lisp lists every Try case', () =>
    assert.deepEqual(tryExpressions(),
                     tryCases.map(([expression]) => expression)))

  test('the default S expression exposes each fold frame', () =>
    assert.deepEqual(serializeSteps(compile(source)),
                     ['(((((0 2) (1 2)) a) b) c)',
                      '((((a 1) (0 1)) b) c)',
                      '((a c) (b c))']))

  test('Z settles when the body returns a constant', () => {
    const fixedValue = serializeTicks(compile(program('(fix (K a))')), 12)
    const appliedValue = serializeTicks(compile(program('((fix (K a)) b)')), 12)

    assert.deepEqual(fixedValue.slice(0, 2), ['(0 a)', 'a'])
    assert.equal(new Set(fixedValue.slice(1)).size, 1)
    assert.deepEqual(appliedValue.slice(0, 2), ['((0 a) b)', '(a b)'])
    assert.equal(new Set(appliedValue.slice(1)).size, 1)
  })

  test('Z keeps recursive state updates live', () => {
    const term = compile(program(`
      (defn STEP (self state) (self (state tick)))
      ((Z STEP) seed)
    `))
    const ticks = serializeTicks(term, 12)

    assert(ticks.every(tick => tick.includes('seed')))
    assert(ticks.slice(1).every(tick => tick.includes('tick')))
    assert(new Set(ticks).size > 4)
    assertDoesNotSettle(term)
  })

  test('Z can return state and settle', () =>
    assert.equal(settle(`
      (defn DONE (self state) state)
      ((Z DONE) seed)
    `), 'seed'))

  test('Z can carry state unchanged without settling', () => {
    const term = compile(program(`
      (defn HOLD (self state) (self state))
      ((Z HOLD) seed)
    `))
    const ticks = serializeTicks(term, 12)

    assert(ticks.every(tick => tick.includes('seed')))
    assert(new Set(ticks).size > 4)
    assertDoesNotSettle(term)
  })

  test('Y I stays live without state', () => {
    const term = compile(program('(Y I)'))
    const ticks = serializeTicks(term, 6)

    assert(new Set(ticks).size > 4)
    assertDoesNotSettle(term)
  })

  test('applied Y I keeps its argument visible', () => {
    const term = compile(program('(def y (Y I))\n(y a)'))
    const ticks = serializeTicks(term, 8)

    assert(ticks.every(tick => tick.includes('a')))
    assert(new Set(ticks).size > 4)
    assertDoesNotSettle(term)
  })

  definitionCases.forEach(([name, expression, expected]) => {
    test(`${name} reaches its source-level result`, () =>
      assert.equal(settle(expression), expected))
  })

  tryCases.forEach(([expression, expected]) => {
    test(`Try expression ${expression} reaches ${expected}`, () =>
      assert.equal(settle(expression), expected))
  })
})
