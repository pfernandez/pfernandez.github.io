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
    ['B', '(((B f) g) x)', '(f (((0 1) g) x))'],
    ['compose', '(((compose f) g) x)', '(f (((0 1) g) x))'],
    ['C', '(((C f) x) y)', '((f (0 y)) x)'],
    ['flip', '(((flip f) x) y)', '((f (0 y)) x)'],
    ['W', '((W f) x)', '((f (0 x)) x)'],
    ['split', '((split f) x)', '((f (0 x)) x)'],
    ['true', '((true a) b)', 'a'],
    ['false', '((false a) b)', 'b'],
    ['if', '(((if p) th) el)', '((p (0 th)) el)'],
    ['not', '(((not p) x) y)', '((p (0 y)) x)'],
    ['and', '((((and p) q) x) y)',
     '((p (((((0 1) 2) q) x) y)) y)'],
    ['or', '((((or p) q) x) y)', '(((p 0) ((q 0) y)) x)'],
    ['pair', '(((pair a) b) f)', '((f (0 a)) b)'],
    ['first', '(first p)', '(p true)'],
    ['second', '(second p)', '(p false)'],
    ['curry', '(((curry f) x) y)', '(f ((((pair 0) 1) x) y))'],
    ['uncurry', '((uncurry f) p)', '((f ((0 (0 p)) true)) (p false))'],
    ['left', '((left x) y)', 'x'],
    ['right', '((right x) y)', 'y'],
    ['self', '(self x)', 'x'],
    ['zero', '((zero f) x)', 'x'],
    ['one', '((one f) x)', '(f (0 x))'],
    ['two', '((two f) x)', '(f (((0 1) f) x))'],
    ['succ', '(((succ n) f) x)', '(f (((((0 1) 2) n) f) x))'],
    ['add', '((((add m) n) f) x)', '(((m 0) ((n 0) x)) f)'],
    ['mul', '((((mul m) n) f) x)', '((m (((0 1) n) f)) x)'],
    ['is-zero', '(is-zero n)', '((n (K false)) true)'],
    ['APPLY-SELF', '((APPLY-SELF x) v)', '((x (0 x)) v)'],
    ['apply-self', '((apply-self x) v)', '((x (0 x)) v)'],
    ['THETA', '((THETA f) x)', '(f (APPLY-SELF (0 x)))'],
    ['theta', '((theta f) x)', '(f (APPLY-SELF (0 x)))'],
    ['Z', '(Z f)', '(f (APPLY-SELF (0 (THETA (0 f)))))'],
    ['fix', '(fix f)', '(f (APPLY-SELF (0 (THETA (0 f)))))']
  ]

const tryCases =
  [
    ['(((S a) b) c)', '((a c) (b c))'],
    ['(((pair a) b) left)', '((left (0 a)) b)'],
    ['((((add one) two) f) x)', '(((one 0) ((two 0) x)) f)'],
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

const settle = expression =>
  serialize(observeUntilStable(compile(program(expression))))

describe('source.lisp examples', () => {
  test('covers every definition in source.lisp', () =>
    assert.deepEqual(definitionCases.map(([name]) => name).sort(),
                     namesInSource()))

  test('names the empty boundary as source-level identity', () => {
    assert.equal(serialize(compile(program('I'))), '()')
    assert.equal(settle('(() a)'), 'a')
    assert.equal(settle('(I a)'), 'a')
    assert.equal(settle('(id a)'), 'a')
  })

  test('keeps the commented Try list covered', () =>
    assert.deepEqual(tryExpressions(), tryCases.map(([expression]) => expression)))

  test('runs the default S expression one observed fold at a time', () =>
    assert.deepEqual(serializeSteps(compile(source)),
                     ['(((((0 2) (1 2)) a) b) c)',
                      '((((a 1) (0 1)) b) c)',
                      '(((a 0) (b 0)) c)',
                      '((a c) (b c))']))

  test('exposes each source definition under the current observer', () =>
    definitionCases.forEach(([name, expression, expected]) =>
      assert.equal(settle(expression), expected, name)))

  test('documents the current Try expression outcomes', () =>
    tryCases.forEach(([expression, expected]) =>
      assert.equal(settle(expression), expected, expression)))
})
