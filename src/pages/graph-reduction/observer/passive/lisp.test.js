import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  createJsRuntime,
  createRepl,
  createWasmRuntime,
  evaluate
} from './lisp.js'

const cases = [
  ['returns the empty form for an empty program', '', '()'],
  ['compiles an atom', 'a', 'a'],
  ['compiles the empty list as the root', '()', '()'],
  ['compiles a unary application', '(I a)', '(I a)'],
  ['compiles n-ary application as left-associated pairs', '(S a b c)', '(((S a) b) c)'],
  ['compiles nested application', '(f (g x) y)', '((f (g x)) y)'],
  ['treats basis names as ordinary form heads', '(add one two f x)', '((((add one) two) f) x)'],
  ['compiles unknown symbols the same way', '(launch star field)', '((launch star) field)']
]

describe('passive Lisp compiler', () => {
  const reaches = (node, target, seen = new Set()) => {
    if (node === target) return true
    if (!Array.isArray(node) || seen.has(node)) return false
    seen.add(node)

    return reaches(node[0], target, seen) || reaches(node[1], target, seen)
  }

  for (const [name, source, expected] of cases) {
    test(`JS ${name}`, () => {
      assert.equal(compile(source).text, expected)
    })
  }

  test('evaluate is a compatibility alias for compile', () => {
    assert.equal(evaluate('(I a)').text, '(I a)')
  })

  test('compiled I form is constructed but not reduced', () => {
    const repl = createRepl()
    const result = repl.compile('(I a)')
    const form = result.result
    const operator = result.runtime.left(form)
    const operand = result.runtime.right(form)

    assert.equal(result.text, '(I a)')
    assert.equal(repl.serialize(operator), 'I')
    assert.equal(repl.serialize(operand), 'a')
    assert.notEqual(form, operand)
    assert.equal(result.runtime.observe(result.frame), form)
    assert.equal(result.runtime.left(result.graph), result.runtime.I)
    assert.equal(result.runtime.right(result.graph), form)
  })

  test('shows each source to observe stage explicitly', () => {
    const repl = createRepl()
    const precompiled = '(I a)'
    const result = repl.compile(precompiled)
    const compiled = result.frame
    const reduced = result.runtime.observe(compiled)
    const serialized = repl.serialize(reduced)
    const IForm = repl.symbol('I')
    const a = repl.symbol('a')

    assert.equal(precompiled, '(I a)')
    assert.deepEqual(result.ast, ['I', 'a'])
    assert.deepEqual(compiled, [result.runtime.I, [result.runtime.I, [IForm, a]]])
    assert.equal(reduced, result.result)
    assert.equal(serialized, '(I a)')
  })

  test('shows each S source to observe stage explicitly', () => {
    const repl = createRepl()
    const precompiled = '(S a b c)'
    const result = repl.compile(precompiled)
    const compiled = result.frame
    const reduced = result.runtime.observe(compiled)
    const serialized = repl.serialize(reduced)
    const SForm = repl.symbol('S')
    const a = repl.symbol('a')
    const b = repl.symbol('b')
    const c = repl.symbol('c')

    assert.equal(precompiled, '(S a b c)')
    assert.deepEqual(result.ast, [[['S', 'a'], 'b'], 'c'])
    assert.deepEqual(compiled, [
      result.runtime.I,
      [result.runtime.I, [[[SForm, a], b], c]]
    ])
    assert.equal(reduced, result.result)
    assert.equal(serialized, '(((S a) b) c)')
  })

  test('defn S compiles to an observe motif without S in the graph', () => {
    const repl = createRepl()
    const precompiled = `
      (defn S (a b c) ((a c) (b c)))
      (S x y z)
    `
    const result = repl.compile(precompiled)
    const compiled = result.frame
    const graph = result.graph
    const future = result.runtime.left(graph)
    const application = result.runtime.right(graph)
    const reduced = result.runtime.observe(compiled)
    const serialized = repl.serialize(reduced)
    const x = result.runtime.left(result.runtime.left(application))
    const y = result.runtime.right(result.runtime.left(application))
    const z = result.runtime.right(application)
    const SForm = repl.symbol('S')

    assert.deepEqual(result.ast, [[['S', 'x'], 'y'], 'z'])
    assert.equal(compiled[0], graph)
    assert.equal(compiled[1], graph)
    assert.equal(future[0], graph)
    assert.equal(future[1], reduced)
    assert.equal(serialized, '((x z) (y z))')
    assert.equal(result.runtime.left(result.runtime.left(reduced)), x)
    assert.equal(result.runtime.right(result.runtime.left(reduced)), z)
    assert.equal(result.runtime.left(result.runtime.right(reduced)), y)
    assert.equal(result.runtime.right(result.runtime.right(reduced)), z)
    assert.equal(
      result.runtime.right(result.runtime.left(reduced)),
      result.runtime.right(result.runtime.right(reduced))
    )
    assert.equal(reaches(graph, SForm), false)
  })

  test('partial defn application can be stored and completed', () => {
    const repl = createRepl()

    repl.compile('(defn K (a b) a)')
    assert.equal(repl.compile('(def kx (K x))').text, 'kx')

    const partial = repl.compile('kx')
    const result = repl.compile('(kx y)')
    const graph = result.graph
    const application = result.runtime.right(graph)
    const x = result.runtime.left(application)
    const y = result.runtime.right(application)
    const KForm = repl.symbol('K')

    assert.equal(result.text, 'x')
    assert.equal(partial.text, '(x ())')
    assert.equal(result.result, x)
    assert.equal(repl.serialize(y), 'y')
    assert.equal(reaches(partial.graph, KForm), false)
    assert.equal(reaches(graph, KForm), false)
  })

  test('aliases can name compound heads inside defn bodies', () => {
    const repl = createRepl()

    repl.compile('(def seed (f a))')
    repl.compile('(defn use (x) (seed x))')

    assert.equal(repl.compile('(use b)').text, '((f a) b)')
  })

  test('compiled S form preserves repeated symbols as shared pointers', () => {
    const repl = createRepl()
    const result = repl.compile('(S a b a)')
    const form = result.result
    const firstA = result.runtime.right(result.runtime.left(result.runtime.left(form)))
    const finalA = result.runtime.right(form)

    assert.equal(result.text, '(((S a) b) a)')
    assert.equal(firstA, finalA)
  })

  test('definitions persist as source aliases without reducing', () => {
    const repl = createRepl()

    assert.equal(repl.compile('(def same I)').text, 'same')
    assert.equal(repl.compile('(same a)').text, '(I a)')
  })

  test('whole-form definitions extend later applications', () => {
    const repl = createRepl()

    assert.equal(repl.compile('(def seed (f a))').text, 'seed')
    assert.equal(repl.compile('(seed b)').text, '((f a) b)')
  })

  test('cyclic aliases fail before graph construction', () => {
    const repl = createRepl()

    repl.compile('(def a b)')
    repl.compile('(def b a)')

    assert.throws(() => repl.compile('a'), /cyclic alias: a -> b -> a/)
  })

  test('serializer pattern matches simple symbol forms', () => {
    const repl = createRepl()
    const a = repl.symbol('a')
    const b = repl.symbol('b')
    const pair = repl.runtime.pair(a, b)

    assert.equal(repl.serialize(a), 'a')
    assert.equal(repl.serialize(b), 'b')
    assert.equal(repl.serialize(pair), '(a b)')
  })

  test('serializer names cycles by their path', () => {
    const repl = createRepl()
    const loop = repl.runtime.pair()

    repl.runtime.setLeft(loop, repl.symbol('loop'))
    repl.runtime.setRight(loop, loop)

    assert.equal(repl.serialize(loop), '(loop $)')
  })

  test('each JS REPL has a local root', () => {
    const first = createRepl()
    const second = createRepl()

    assert.notEqual(first.runtime.I, second.runtime.I)
    assert.equal(first.compile('(I a)').text, '(I a)')
    assert.equal(second.compile('(I a)').text, '(I a)')
  })

  test('WASM compiles the same unreduced forms', async () => {
    const repl = createRepl(await createWasmRuntime())

    assert.equal(repl.compile('(I a)').text, '(I a)')
    assert.equal(repl.compile('(K a b)').text, '((K a) b)')
    assert.equal(repl.compile('(S a b c)').text, '(((S a) b) c)')
    assert.equal(repl.compile('(first ((pair a) b))').text, '(first ((pair a) b))')
  })

  test('WASM graph is selected by passive observe without reducing', async () => {
    const repl = createRepl(await createWasmRuntime())
    const before = repl.runtime.size()
    const result = repl.compile('(I a)')
    const form = result.result
    const operator = result.runtime.left(form)
    const operand = result.runtime.right(form)

    assert.equal(repl.runtime.observe(result.frame), form)
    assert.equal(repl.runtime.left(result.graph), repl.runtime.I)
    assert.equal(repl.runtime.right(result.graph), form)
    assert.equal(repl.serialize(operator), 'I')
    assert.equal(repl.serialize(operand), 'a')
    assert.equal(result.text, '(I a)')
    assert.equal(repl.runtime.size(), before + 6)
  })

  test('a custom JS runtime can be supplied', () => {
    const runtime = createJsRuntime()
    const repl = createRepl(runtime)

    assert.equal(repl.runtime, runtime)
    assert.equal(repl.compile('((right a) b)').text, '((right a) b)')
  })

  test('JS runtime setters mutate slots and return the pair', () => {
    const runtime = createJsRuntime()
    const pair = runtime.pair()
    const left = runtime.pair()
    const right = runtime.pair()

    assert.equal(runtime.setLeft(pair, left), pair)
    assert.equal(runtime.setRight(pair, right), pair)
    assert.equal(runtime.left(pair), left)
    assert.equal(runtime.right(pair), right)
  })

  test('defn declarations return their name', () => {
    const repl = createRepl()

    assert.equal(repl.compile('(defn id (x) x)').text, 'id')
  })
})
