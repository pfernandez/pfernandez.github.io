import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  compile,
  init,
  parse,
  serialize
} from './observer/lisp.js'

const core = readFileSync(new URL('./source.lisp', import.meta.url), 'utf8')

const compileGraph = source => {
  const [state, graph] = compile(init(), parse(source))

  return { graph, state }
}

const compileText = source => {
  const { graph, state } = compileGraph(source)

  return serialize(state, graph)
}

const evaluate = source => {
  const { graph, state } = compileGraph(`${core}\n${source}`)
  const result = state.runtime.observe(graph)

  return serialize(state, result)
}

const cases = [
  ['I returns its argument', '(I a)', 'a'],
  ['K keeps the first argument', '((K a) b)', 'a'],
  ['S distributes the final argument', '(((S a) b) c)', '((a c) (b c))'],
  ['B composes two functions', '(((B f) g) x)', '(f (g x))'],
  ['C swaps the final two arguments', '(((C f) x) y)', '((f y) x)'],
  ['W duplicates its argument', '((W f) x)', '((f x) x)'],
  ['true chooses the first branch', '((true a) b)', 'a'],
  ['false chooses the second branch', '((false a) b)', 'b'],
  ['const keeps the first argument', '((const a) b)', 'a'],
  ['if chooses the true branch', '(((if true) a) b)', 'a'],
  ['if chooses the false branch', '(((if false) a) b)', 'b'],
  ['not flips true', '(((not true) a) b)', 'b'],
  ['not flips false', '(((not false) a) b)', 'a'],
  ['and keeps true when both are true', '((((and true) true) a) b)', 'a'],
  ['and rejects a false right side', '((((and true) false) a) b)', 'b'],
  ['and rejects a false left side', '((((and false) true) a) b)', 'b'],
  ['or rejects when both are false', '((((or false) false) a) b)', 'b'],
  ['or accepts a true right side', '((((or false) true) a) b)', 'a'],
  ['first reads the first pair value', '(first ((pair a) b))', 'a'],
  ['second reads the second pair value', '(second ((pair a) b))', 'b'],
  ['curry packs two arguments', '(((curry f) a) b)', '(f ((a b) ()))'],
  ['uncurry unpacks one pair argument', '((uncurry f) ((pair a) b))', '((f a) b)'],
  ['left keeps the left value', '((left a) b)', 'a'],
  ['right keeps the right value', '((right a) b)', 'b'],
  ['self returns its argument', '(self a)', 'a'],
  ['zero applies no functions', '((zero f) x)', 'x'],
  ['one applies one function', '((one f) x)', '(f x)'],
  ['two applies two functions', '((two f) x)', '(f (f x))'],
  ['succ increments zero', '(((succ zero) f) x)', '(f x)'],
  ['add combines one and two', '((((add one) two) f) x)', '(f (f (f x)))'],
  ['mul combines two and two', '((((mul two) two) f) x)', '(f (f (f (f x))))'],
  ['is-zero accepts zero', '(((is-zero zero) a) b)', 'a'],
  ['is-zero rejects one', '(((is-zero one) a) b)', 'b']
]

for (const [name, source, expected] of cases) {
  test(name, () => {
    assert.equal(evaluate(source), expected)
  })
}

test('source.lisp compiles to a minimal observation frame', () => {
  assert.equal(
    compileText(core),
    '((($[0] ((a c) (b c))) ((a b) c)) $[0])'
  )
})

test('observe takes the compiled source graph to S normal form', () => {
  assert.equal(evaluate(''), '((a c) (b c))')
})

test('define aliases resolve before wiring a call', () => {
  assert.equal(compileText(`
    (define (I x) x)
    (define same I)
    (same a)
  `), '((($[0] a) a) $[0])')
})

test('define aliases can name whole forms', () => {
  assert.equal(compileText(`
    (define (I x) x)
    (define same (I a))
    same
  `), '((($[0] a) a) $[0])')
})

test('applications emit a redex for observe', () => {
  const { graph, state } = compileGraph(`
    (define (I x) x)
    (I a)
  `)

  assert.equal(serialize(state, graph), '((($[0] a) a) $[0])')
  assert.equal(serialize(state, state.runtime.observe(graph)), 'a')
})

test('definition wiring preserves fan-in to the result', () => {
  const { graph, state } = compileGraph(`
    (define (S x y z) ((x z) (y z)))
    (S a b c)
  `)
  const result = state.runtime.observe(graph)
  const firstShared = state.runtime.right(state.runtime.left(result))
  const secondShared = state.runtime.right(state.runtime.right(result))

  assert.equal(firstShared, secondShared)
})

test('cyclic aliases fail before graph construction', () => {
  assert.throws(
    () => compileGraph(`
      (define a b)
      (define b a)
      a
    `),
    /cyclic alias: a -> b -> a/
  )
})
