import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile,
  compileMachine,
  createJsRuntime,
  createWasmRuntime,
  init,
  kernelSource,
  machineCurrent,
  machineOutput,
  machineStep,
  parse,
  serialize,
  sourceStep,
  symbol,
} from './lisp.js'

const cases = [
  ['returns the empty form for an empty program', '', '()'],
  ['compiles an atom', 'a', 'a'],
  ['compiles the empty list as the root', '()', '()'],
  ['compiles a unary pair', '(I a)', '(I a)'],
  [
    'compiles n-ary source as a chain',
    '(S a b c)',
    '(((S a) b) c)',
  ],
  ['compiles nested chains', '(f (g x) y)', '((f (g x)) y)'],
  [
    'treats basis names as ordinary chain values',
    '(add one two f x)',
    '((((add one) two) f) x)',
  ],
  [
    'compiles unknown symbols the same way',
    '(launch star field)',
    '((launch star) field)',
  ],
]

describe('passive Lisp compiler', () => {
  const run = (state, source) => {
    const ast = parse(source)
    const [nextState, graph] = compile(state, ast)
    const result = nextState.runtime.observe(graph)

    return [nextState, {
      ast,
      graph,
      result,
      text: serialize(nextState, result),
    }]
  }

  const compileInto = (state, source) => compile(state, parse(source))[0]

  const reaches = (node, target, seen = new Set()) => {
    if (node === target) return true
    if (!Array.isArray(node) || seen.has(node)) return false
    seen.add(node)

    return reaches(node[0], target, seen) || reaches(node[1], target, seen)
  }

  for (const [name, source, expected] of cases) {
    test(`JS ${name}`, () => {
      const [, result] = run(init(), source)

      assert.equal(result.text, expected)
    })
  }

  test('compile returns new source state without mutating old state', () => {
    const state = init()
    const [nextState, graph] = compile(state, parse('a'))
    const result = nextState.runtime.observe(graph)

    assert.notEqual(nextState, state)
    assert.equal(state.symbols.size, 0)
    assert.equal(nextState.symbols.size, 1)
    assert.equal(serialize(nextState, result), 'a')
  })

  test('compiled I form is constructed but not reduced', () => {
    const state = init()
    const [nextState, { graph, result, text }] = run(state, '(I a)')
    const operator = nextState.runtime.left(result)
    const operand = nextState.runtime.right(result)

    assert.equal(text, '(I a)')
    assert.equal(serialize(nextState, operator), 'I')
    assert.equal(serialize(nextState, operand), 'a')
    assert.notEqual(result, operand)
    assert.equal(nextState.runtime.observe(graph), result)
    assert.equal(nextState.runtime.left(graph), nextState.runtime.I)

    const focus = nextState.runtime.right(graph)

    assert.equal(nextState.runtime.left(focus), nextState.runtime.I)
    assert.equal(nextState.runtime.right(focus), result)
  })

  test('shows each source to observe stage explicitly', () => {
    const state = init()
    const precompiled = '(I a)'
    const ast = parse(precompiled)
    const [compiledState, graph] = compile(state, ast)
    const reduced = compiledState.runtime.observe(graph)
    const serialized = serialize(compiledState, reduced)
    const [IState, IForm] = symbol(compiledState, 'I')
    const [, a] = symbol(IState, 'a')

    assert.equal(precompiled, '(I a)')
    assert.deepEqual(ast, [['I', 'a']])
    assert.deepEqual(graph, [
      compiledState.runtime.I,
      [compiledState.runtime.I, [IForm, a]],
    ])
    assert.equal(serialized, '(I a)')
  })

  test('shows each S source to observe stage explicitly', () => {
    const state = init()
    const precompiled = '(S a b c)'
    const ast = parse(precompiled)
    const [compiledState, graph] = compile(state, ast)
    const reduced = compiledState.runtime.observe(graph)
    const serialized = serialize(compiledState, reduced)
    const [SState, SForm] = symbol(compiledState, 'S')
    const [aState, a] = symbol(SState, 'a')
    const [bState, b] = symbol(aState, 'b')
    const [, c] = symbol(bState, 'c')

    assert.equal(precompiled, '(S a b c)')
    assert.deepEqual(ast, [['S', 'a', 'b', 'c']])
    assert.deepEqual(graph, [
      compiledState.runtime.I,
      [compiledState.runtime.I, [[[SForm, a], b], c]],
    ])
    assert.equal(serialized, '(((S a) b) c)')
  })

  test('define S compiles to an observe motif without S in the graph', () => {
    const precompiled = `
      (define (S a b c) ((a c) (b c)))
      (S x y z)
    `
    const ast = parse(precompiled)
    const [compiledState, graph] = compile(init(), ast)
    const focus = graph[0]
    const future = focus[0]
    const pair = focus[1]
    const reduced = compiledState.runtime.observe(graph)
    const serialized = serialize(compiledState, reduced)
    const x = pair[0][0]
    const y = pair[0][1]
    const z = pair[1]
    const [, SForm] = symbol(compiledState, 'S')

    assert.deepEqual(ast, [
      ['define', ['S', 'a', 'b', 'c'], [['a', 'c'], ['b', 'c']]],
      ['S', 'x', 'y', 'z'],
    ])
    assert.equal(graph[0], focus)
    assert.equal(graph[1], focus)
    assert.equal(future[0], focus)
    assert.equal(future[1], reduced)
    assert.equal(serialized, '((x z) (y z))')
    assert.equal(reduced[0][0], x)
    assert.equal(reduced[0][1], z)
    assert.equal(reduced[1][0], y)
    assert.equal(reduced[1][1], z)
    assert.equal(reduced[0][1], reduced[1][1])
    assert.equal(reaches(focus, SForm), false)
  })

  test('partial define pair can be stored and completed', () => {
    let state = init()
    state = compileInto(state, '(define (K a b) a)')
    state = compileInto(state, '(define kx (K x))')

    const [partialState, partial] = run(state, 'kx')
    const [completedState, completed] = run(partialState, '(kx y)')
    const focus = completed.graph[0]
    const pair = focus[1]
    const x = pair[0]
    const y = pair[1]
    const [, KForm] = symbol(completedState, 'K')

    assert.equal(completed.text, 'x')
    assert.equal(partial.text, '(x ())')
    assert.equal(completed.result, x)
    assert.equal(serialize(completedState, y), 'y')
    assert.equal(reaches(partial.result, KForm), false)
    assert.equal(reaches(focus, KForm), false)
  })

  test('aliases can name compound first values inside define bodies', () => {
    let state = init()
    state = compileInto(state, '(define seed (f a))')
    state = compileInto(state, '(define (use x) (seed x))')

    const [, result] = run(state, '(use b)')

    assert.equal(result.text, '((f a) b)')
  })

  test('compiled S form preserves repeated symbols as shared pointers', () => {
    const [, { result, text }] = run(init(), '(S a b a)')
    const partial = result[0][0]
    const firstA = partial[1]
    const finalA = result[1]

    assert.equal(text, '(((S a) b) a)')
    assert.equal(firstA, finalA)
  })

  test('definitions persist as source aliases without reducing', () => {
    let state = init()
    state = compileInto(state, '(define same I)')

    const [, result] = run(state, '(same a)')

    assert.equal(result.text, '(I a)')
  })

  test('whole-form definitions extend later chains', () => {
    let state = init()
    state = compileInto(state, '(define seed (f a))')

    const [, result] = run(state, '(seed b)')

    assert.equal(result.text, '((f a) b)')
  })

  test('defined functions can be passed as values', () => {
    let state = init()
    state = compileInto(state, '(define (K a b) a)')
    state = compileInto(state, '(define (call f x y) (f x y))')

    const [, result] = run(state, '(call K x y)')

    assert.equal(result.text, 'x')
  })

  test('source pairs can be built from function values', () => {
    let state = init()
    state = compileInto(state, kernelSource)

    const [firstState, first] = run(state, '(first (pair x y))')
    const [, second] = run(firstState, '(second (pair x y))')

    assert.equal(first.text, 'x')
    assert.equal(second.text, 'y')
  })

  test('kernel source supplies the minimal combinator basis', () => {
    let state = init()
    state = compileInto(state, kernelSource)

    assert.equal(run(state, '(I x)')[1].text, 'x')
    assert.equal(run(state, '(K x y)')[1].text, 'x')
    assert.equal(run(state, '(S K K x)')[1].text, 'x')
  })

  test('kernel source supplies boolean choice', () => {
    let state = init()
    state = compileInto(state, kernelSource)

    assert.equal(run(state, '(true x y)')[1].text, 'x')
    assert.equal(run(state, '(false x y)')[1].text, 'y')
    assert.equal(run(state, '(not true x y)')[1].text, 'y')
    assert.equal(run(state, '(not false x y)')[1].text, 'x')
    assert.equal(run(state, '(and true false x y)')[1].text, 'y')
    assert.equal(run(state, '(or false true x y)')[1].text, 'x')
  })

  test('kernel source supplies Church numerals', () => {
    let state = init()
    state = compileInto(state, kernelSource)

    assert.equal(run(state, '(zero f x)')[1].text, 'x')
    assert.equal(run(state, '(one f x)')[1].text, '(f x)')
    assert.equal(run(state, '(two f x)')[1].text, '(f (f x))')
    assert.equal(run(state, '(succ one f x)')[1].text, '(f (f x))')
    assert.equal(run(state, '(add one two f x)')[1].text, (
      '(f (f (f x)))'
    ))
    assert.equal(run(state, '(mul two two f x)')[1].text, (
      '(f (f (f (f x))))'
    ))
    assert.equal(run(state, '(is-zero zero x y)')[1].text, 'x')
    assert.equal(run(state, '(is-zero one x y)')[1].text, 'y')
  })

  test('sourceStep is the smallest REPL boundary', () => {
    let state = init()
    state = compileInto(state, kernelSource)

    const [nextState, first] = sourceStep(state, '(first (pair x y))')
    const [, second] = sourceStep(nextState, '(second (pair x y))')

    assert.equal(serialize(nextState, first), 'x')
    assert.equal(serialize(nextState, second), 'y')
  })

  test('compileMachine returns a step-shaped JS machine', () => {
    const state = init()
    const [nextState, machine] = compileMachine(state, parse('(I a)'))
    const sourceFrame = nextState.runtime.left(machine)
    const current = nextState.runtime.right(machine)
    const carried = nextState.runtime.left(current)
    const output = nextState.runtime.right(carried)
    const next = nextState.runtime.right(current)

    assert.equal(serialize(nextState, output), '(I a)')
    assert.equal(nextState.runtime.right(carried), output)
    assert.equal(nextState.runtime.observe(sourceFrame), output)
    assert.equal(next, current)
    assert.equal(nextState.runtime.observe(
      nextState.runtime.frame(machine, current)
    ), next)
  })

  test('compileMachine chains JS expression states', () => {
    const state = init()
    const [nextState, machine] = compileMachine(
      state,
      parse('(I a) (I b)')
    )
    const first = nextState.runtime.right(machine)
    const second = nextState.runtime.right(first)
    const firstOutput = nextState.runtime.right(nextState.runtime.left(first))
    const secondOutput = nextState.runtime.right(nextState.runtime.left(second))

    assert.notEqual(first, second)
    assert.equal(serialize(nextState, firstOutput), '(I a)')
    assert.equal(serialize(nextState, secondOutput), '(I b)')
    assert.equal(nextState.runtime.right(second), first)
    assert.equal(nextState.runtime.observe(
      nextState.runtime.frame(machine, first)
    ), second)
    assert.equal(nextState.runtime.observe(
      nextState.runtime.frame(machine, second)
    ), first)
  })

  test('machineStep advances JS root through expression states', () => {
    const state = init()
    const [nextState, machine] = compileMachine(
      state,
      parse('(I a) (I b)')
    )
    const first = machineCurrent(nextState, machine)
    const second = nextState.runtime.right(first)

    assert.equal(serialize(nextState, machineOutput(nextState, machine)), (
      '(I a)'
    ))
    assert.equal(machineStep(nextState, machine), second)
    assert.equal(machineCurrent(nextState, machine), second)
    assert.equal(serialize(nextState, machineOutput(nextState, machine)), (
      '(I b)'
    ))
    assert.equal(machineStep(nextState, machine), first)
    assert.equal(machineCurrent(nextState, machine), first)
  })

  test('compileMachine keeps definitions without forcing output', () => {
    const state = init()
    const [nextState, machine] = compileMachine(
      state,
      parse('(define alias value)')
    )
    const current = nextState.runtime.right(machine)
    const output = nextState.runtime.right(nextState.runtime.left(current))
    const [, resolved] = run(nextState, 'alias')

    assert.equal(output, nextState.runtime.I)
    assert.equal(nextState.runtime.right(current), current)
    assert.equal(resolved.text, 'value')
    assert.equal(nextState.runtime.observe(
      nextState.runtime.frame(machine, current)
    ), current)
  })

  test('recursive define ties a graph knot during construction', () => {
    let state = init()
    state = compileInto(state, '(define I (I I))')

    const [, result] = run(state, 'I')
    const value = result.result

    assert.equal(result.text, 'I')
    assert.equal(state.runtime.left(value), value)
    assert.equal(state.runtime.right(value), value)
    const selected = state.runtime.observe(state.runtime.frame(value, value))

    assert.equal(selected, value)
  })

  test('recursive define can be paired with another value', () => {
    let state = init()
    state = compileInto(state, '(define I (I I))')

    const [nextState, result] = run(state, '(I x)')
    const value = result.result[0]

    assert.equal(result.text, '(I x)')
    assert.equal(state.runtime.left(value), value)
    assert.equal(serialize(nextState, result.result[1]), 'x')
  })

  test('cyclic aliases fail before graph construction', () => {
    let state = init()
    state = compileInto(state, '(define a b)')
    state = compileInto(state, '(define b a)')

    assert.throws(
      () => compile(state, parse('a')),
      /cyclic alias: a -> b -> a/
    )
  })

  test('serializer pattern matches simple symbol forms', () => {
    let state = init()
    const aResult = symbol(state, 'a')
    const a = aResult[1]

    state = aResult[0]

    const bResult = symbol(state, 'b')
    const b = bResult[1]

    state = bResult[0]

    const pair = state.runtime.pair(a, b)

    assert.equal(serialize(state, a), 'a')
    assert.equal(serialize(state, b), 'b')
    assert.equal(serialize(state, pair), '(a b)')
  })

  test('serializer names cycles by their path', () => {
    let state = init()
    const loopResult = symbol(state, 'loop')
    const loopSymbol = loopResult[1]

    state = loopResult[0]
    const loop = state.runtime.pair()

    state.runtime.setLeft(loop, loopSymbol)
    state.runtime.setRight(loop, loop)

    assert.equal(serialize(state, loop), '(loop $)')
  })

  test('init gives each compiler a local root', () => {
    const first = init()
    const second = init()
    const [, firstResult] = run(first, '(I a)')
    const [, secondResult] = run(second, '(I a)')

    assert.notEqual(first.runtime.I, second.runtime.I)
    assert.equal(firstResult.text, '(I a)')
    assert.equal(secondResult.text, '(I a)')
  })

  test('WASM compiles the same unreduced forms', async () => {
    const state = init(await createWasmRuntime())

    assert.equal(run(state, '(I a)')[1].text, '(I a)')
    assert.equal(run(state, '(K a b)')[1].text, '((K a) b)')
    assert.equal(run(state, '(S a b c)')[1].text, '(((S a) b) c)')
    assert.equal(run(state, '(first ((pair a) b))')[1].text, (
      '(first ((pair a) b))'
    ))
  })

  test('WASM graph is selected without reducing', async () => {
    const state = init(await createWasmRuntime())
    const before = state.runtime.size()
    const [nextState, { graph, result, text }] = run(state, '(I a)')
    const operator = nextState.runtime.left(result)
    const operand = nextState.runtime.right(result)

    assert.equal(nextState.runtime.observe(graph), result)
    assert.equal(nextState.runtime.left(graph), nextState.runtime.I)

    const focus = nextState.runtime.right(graph)

    assert.equal(nextState.runtime.left(focus), nextState.runtime.I)
    assert.equal(nextState.runtime.right(focus), result)
    assert.equal(serialize(nextState, operator), 'I')
    assert.equal(serialize(nextState, operand), 'a')
    assert.equal(text, '(I a)')
    assert.equal(nextState.runtime.size(), before + 6)
  })

  test('WASM recursive define ties a pointer knot', async () => {
    let state = init(await createWasmRuntime())
    state = compileInto(state, '(define I (I I))')

    const [, result] = run(state, 'I')
    const value = result.result

    assert.equal(result.text, 'I')
    assert.equal(state.runtime.left(value), value)
    assert.equal(state.runtime.right(value), value)
    const selected = state.runtime.observe(state.runtime.frame(value, value))

    assert.equal(selected, value)
  })

  test('WASM source pairs can be built from function values', async () => {
    let state = init(await createWasmRuntime())
    state = compileInto(state, kernelSource)

    const [firstState, first] = run(state, '(first (pair x y))')
    const [, second] = run(firstState, '(second (pair x y))')

    assert.equal(first.text, 'x')
    assert.equal(second.text, 'y')
  })

  test('WASM kernel source supplies the minimal combinator basis', async () => {
    let state = init(await createWasmRuntime())
    state = compileInto(state, kernelSource)

    assert.equal(run(state, '(I x)')[1].text, 'x')
    assert.equal(run(state, '(K x y)')[1].text, 'x')
    assert.equal(run(state, '(S K K x)')[1].text, 'x')
  })

  test('WASM kernel source supplies boolean choice', async () => {
    let state = init(await createWasmRuntime())
    state = compileInto(state, kernelSource)

    assert.equal(run(state, '(true x y)')[1].text, 'x')
    assert.equal(run(state, '(false x y)')[1].text, 'y')
    assert.equal(run(state, '(not true x y)')[1].text, 'y')
    assert.equal(run(state, '(not false x y)')[1].text, 'x')
    assert.equal(run(state, '(and true false x y)')[1].text, 'y')
    assert.equal(run(state, '(or false true x y)')[1].text, 'x')
  })

  test('WASM kernel source supplies Church numerals', async () => {
    let state = init(await createWasmRuntime())
    state = compileInto(state, kernelSource)

    assert.equal(run(state, '(zero f x)')[1].text, 'x')
    assert.equal(run(state, '(one f x)')[1].text, '(f x)')
    assert.equal(run(state, '(two f x)')[1].text, '(f (f x))')
    assert.equal(run(state, '(succ one f x)')[1].text, '(f (f x))')
    assert.equal(run(state, '(add one two f x)')[1].text, (
      '(f (f (f x)))'
    ))
    assert.equal(run(state, '(mul two two f x)')[1].text, (
      '(f (f (f (f x))))'
    ))
    assert.equal(run(state, '(is-zero zero x y)')[1].text, 'x')
    assert.equal(run(state, '(is-zero one x y)')[1].text, 'y')
  })

  test('WASM sourceStep uses the selected runtime', async () => {
    let state = init(await createWasmRuntime())
    state = compileInto(state, kernelSource)

    const [nextState, first] = sourceStep(state, '(first (pair x y))')
    const [, second] = sourceStep(nextState, '(second (pair x y))')

    assert.equal(serialize(nextState, first), 'x')
    assert.equal(serialize(nextState, second), 'y')
  })

  test('WASM compileMachine returns a step-shaped machine', async () => {
    const state = init(await createWasmRuntime())
    const [nextState, machine] = compileMachine(state, parse('(I a)'))
    const sourceFrame = nextState.runtime.left(machine)
    const current = nextState.runtime.right(machine)
    const carried = nextState.runtime.left(current)
    const output = nextState.runtime.right(carried)
    const next = nextState.runtime.right(current)

    assert.equal(serialize(nextState, output), '(I a)')
    assert.equal(nextState.runtime.right(carried), output)
    assert.equal(nextState.runtime.observe(sourceFrame), output)
    assert.equal(next, current)
    assert.equal(nextState.runtime.observe(
      nextState.runtime.frame(machine, current)
    ), next)
  })

  test('WASM compileMachine chains expression states', async () => {
    const state = init(await createWasmRuntime())
    const [nextState, machine] = compileMachine(
      state,
      parse('(I a) (I b)')
    )
    const first = nextState.runtime.right(machine)
    const second = nextState.runtime.right(first)
    const firstOutput = nextState.runtime.right(nextState.runtime.left(first))
    const secondOutput = nextState.runtime.right(nextState.runtime.left(second))

    assert.notEqual(first, second)
    assert.equal(serialize(nextState, firstOutput), '(I a)')
    assert.equal(serialize(nextState, secondOutput), '(I b)')
    assert.equal(nextState.runtime.right(second), first)
    assert.equal(nextState.runtime.observe(
      nextState.runtime.frame(machine, first)
    ), second)
    assert.equal(nextState.runtime.observe(
      nextState.runtime.frame(machine, second)
    ), first)
  })

  test('machineStep advances WASM root through expression states', async () => {
    const state = init(await createWasmRuntime())
    const [nextState, machine] = compileMachine(
      state,
      parse('(I a) (I b)')
    )
    const first = machineCurrent(nextState, machine)
    const second = nextState.runtime.right(first)

    assert.equal(serialize(nextState, machineOutput(nextState, machine)), (
      '(I a)'
    ))
    assert.equal(machineStep(nextState, machine), second)
    assert.equal(machineCurrent(nextState, machine), second)
    assert.equal(serialize(nextState, machineOutput(nextState, machine)), (
      '(I b)'
    ))
    assert.equal(machineStep(nextState, machine), first)
    assert.equal(machineCurrent(nextState, machine), first)
  })

  test('a custom JS runtime can be supplied', () => {
    const runtime = createJsRuntime()
    const state = init(runtime)
    const [, result] = run(state, '((right a) b)')

    assert.equal(state.runtime, runtime)
    assert.equal(result.text, '((right a) b)')
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

  test('define function declarations build later calls', () => {
    let state = init()
    state = compileInto(state, '(define (id x) x)')

    const [, result] = run(state, '(id a)')

    assert.equal(result.text, 'a')
  })
})
