import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { observe } from './observe.js'
import { compile, serialize } from './sexpr.js'

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

const settle = expression =>
  serialize(observeUntilStable(compile(program(expression))))

const apply = (fn, arg = 'a') =>
  `(${fn} ${arg})`

const assertExposesEqual = (left, right) =>
  assert.equal(settle(left), settle(right), `${left} = ${right}`)

const assertActsEqual = (left, right, arg = 'a') =>
  assertExposesEqual(apply(left, arg), apply(right, arg))

describe('source.lisp examples', () => {
  test('covers every definition in source.lisp', () =>
    assert.deepEqual(definitionCases.map(([name]) => name).sort(),
                     namesInSource()))

  test('names the empty boundary as source-level identity', () => {
    assert.equal(serialize(compile(program('I'))), '()')
    assertExposesEqual('()', 'I')
    assertExposesEqual('I', 'id')
    assertActsEqual('()', 'I')
    assertActsEqual('I', 'id')
  })

  test('recognizes SKK as observational identity', () => {
    assert.equal(settle(apply('I')), 'a')
    assertActsEqual('I', '((S K) K)')
  })

  test('keeps the commented Try list covered', () =>
    assert.deepEqual(tryExpressions(),
                     tryCases.map(([expression]) => expression)))

  test('runs the default S expression one observed fold at a time', () =>
    assert.deepEqual(serializeSteps(compile(source)),
                     ['(((((0 2) (1 2)) a) b) c)',
                      '((((a 1) (0 1)) b) c)',
                      '(((a 0) (b 0)) c)',
                      '((a c) (b c))']))

  test('builds Z fixpoints for contractive functions over many ticks', () => {
    const fixedValue = serializeTicks(compile(program('(fix (K a))')), 12)
    const appliedValue = serializeTicks(compile(program('((fix (K a)) b)')), 12)

    assert.deepEqual(fixedValue.slice(0, 2), ['(0 a)', 'a'])
    assert.equal(new Set(fixedValue.slice(1)).size, 1)
    assert.deepEqual(appliedValue.slice(0, 2), ['((0 a) b)', '(a b)'])
    assert.equal(new Set(appliedValue.slice(1)).size, 1)
  })

  test('tracks the current Z boundary for state transitions', () => {
    const ticks = serializeTicks(compile(program(`
      (defn STEP (self state) (self (next state)))
      ((Z STEP) seed)
    `)), 24)

    assert.deepEqual(ticks.slice(0, 2), ['(0 (next seed))', '(next seed)'])
    assert.equal(new Set(ticks.slice(1)).size, 1)
  })

  test('keeps the stateless Y fixed point cycling', () => {
    const term = compile(program('(Y I)'))

    assert.deepEqual(serializeTicks(term, 4),
                     ['((0 (0 ())) 0)',
                      '((0 ()) 0)',
                      '(() 0)',
                      '0'])
    assert.throws(() => observeUntilStable(term, 32), /did not settle/i)
  })

  definitionCases.forEach(([name, expression, expected]) => {
    test(`reduces ${name} to the desired source-level output`, () =>
      assert.equal(settle(expression), expected))
  })

  tryCases.forEach(([expression, expected]) => {
    test(`reduces Try expression ${expression} to desired output`, () =>
      assert.equal(settle(expression), expected))
  })
})
