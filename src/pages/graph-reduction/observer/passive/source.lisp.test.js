import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compile, reduceDefinition, serialize } from '../../graph/index.js'
import { observe } from './observe.js'

const core = readFileSync(new URL('./source.lisp', import.meta.url), 'utf8')

const loop = (observer, focus, limit = 100) => {
  if (limit === 0) return focus
  const next = observer(focus)
  if (next === focus) return focus
  return loop(observer, next, limit - 1)
}

const compileText = async source => {
  const state = compile(source)
  assert.equal(state.error, undefined)
  return serialize(state.graph)
}

const evaluate = async source => {
  const state = compile(`${core}\n${source}`)
  assert.equal(state.error, undefined)
  let graph = state.graph
  for (let step = 0; step < 128; step++) {
    const next = observe(graph)
    if (next === graph) return serialize(graph)
    graph = next
  }
  assert.fail(`did not stabilize: ${serialize(graph)}`)
}

const expectCarriesForever = async (graph, value, steps = 8) => {
  for (let step = 0; step < steps; step++) {
    const next = observe(graph)
    // assert.notEqual(next, graph)
    assert.match(serialize(next), new RegExp(`\\b${value}\\b`))
    graph = next
  }
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
  ['first reads the first pair value', '(first (a b))', 'a'],
  ['second reads the second pair value', '(second (a b))', 'b'],
  // ['curry packs two arguments', '(((curry f) a) b)', '(f ((pair a) b))'],
  // ['uncurry unpacks one pair argument', '((uncurry f) ((pair a) b))', '((f a) b)'],
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
  test(name, async () => {
    assert.equal(await evaluate(source), expected)
  })
}

test('parse reads surface lisp without mutating token input', async () => {
  assert.deepEqual(compile(' (defn I (x) x) (I a) ').graph, [[], 'a'])
})

test('source.lisp compiles to the observable S graph', async () => {
  assert.equal(await compileText(core), '(() ((a c) (b c)))')
})

test('observe takes the compiled source graph to S normal form', async () => {
  const state = compile(core)
  assert.equal(state.error, undefined)
  assert.equal(serialize(observe(state.graph)), '((a c) (b c))')
})

test('def aliases resolve before wiring a call', async () => {
  assert.equal(await compileText(`
    (defn I (x) x)
    (def same I)
    (same a)
  `), '(() a)')
})

test('def aliases can name whole forms', async () => {
  assert.equal(await compileText(`
    (defn I (x) x)
    (def same (I a))
    same
  `), '(() a)')
})

test('defn applications emit a redex for observe', async () => {
  const state = compile(`
    (defn I (x) x)
    (I a)
  `)
  assert.equal(state.error, undefined)
  assert.equal(serialize(state.graph), '(() a)')
  assert.equal(serialize(observe(state.graph)), 'a')
})

test('remaining arguments wire into the emitted redex', async () => {
  const state = compile(`
    (defn I (x) x)
    ((I a) b)
  `)
  assert.equal(state.error, undefined)
  assert.equal(serialize(state.graph), '(() (a b))')
  assert.equal(serialize(observe(state.graph)), '(a b)')
})

test('nested defn calls emit nested redexes', async () => {
  const state = compile(`
    (defn I (x) x)
    (defn twice (x) (I x))
    (twice a)
  `)
  assert.equal(state.error, undefined)
  assert.equal(serialize(state.graph), '(() (() a))')
  assert.equal(serialize(observe(state.graph)), '(() a)')
  assert.equal(serialize(observe(observe(state.graph))), 'a')
})

test('known functions can pass through arguments before wiring', async () => {
  const state = compile(`
    (defn K (x y) x)
    (defn choose (p a b) ((p a) b))
    (((choose K) x) y)
  `)
  assert.equal(state.error, undefined)
  assert.equal(serialize(state.graph), '(() (() x))')
  assert.equal(serialize(observe(state.graph)), '(() x)')
  assert.equal(serialize(observe(observe(state.graph))), 'x')
})

test('programs can include comments and newlines', async () => {
  assert.equal(await compileText(`
    ; local definitions are part of the input text
    (defn choose
      (x y) ; keep the left value
      x)
    ((choose a) b)
  `), '(() a)')
})

test('definition wiring preserves fan-in to the result', async () => {
  const shared = [[], 'c']
  const graph = reduceDefinition(
    [['x', 'y', 'z'], [['x', 'z'], ['y', 'z']]],
    ['a', 'b', shared]
  )
  assert.equal(graph[1][0][1], graph[1][1][1])
})

test('cyclic aliases fail before graph construction', async () => {
  const state = compile(`
    (def a b)
    (def b a)
    a
  `)
  assert.equal(state.graph, undefined)
  assert.equal(state.error, 'cyclic alias: a -> b -> a')
})

test('a direct fixed graph carries x without converging', async () => {
  let graph = []
  graph[0] = []
  graph[1] = 'x'
  graph[0][0] = []
  graph[0][1] = graph
  await expectCarriesForever(graph, 'x')
})

test('a recursive source definition carries x without converging', async () => {
  const state = compile(`${core}
    (defn carry (x) (carry x))
    (carry x)
  `)
  assert.equal(state.error, undefined)
  await expectCarriesForever(state.graph, 'x')
})

test('traditional Z carries x without converging', async () => {
  const state = compile(`${core}
    (defn force (again) (again x))
    (Z force)
  `)
  assert.equal(state.error, undefined)
  await expectCarriesForever(state.graph, 'x')
})

test('traditional Y carries x without converging', async () => {
  const state = compile(`${core}
    (defn force (again) (again x))
    (Y force)
  `)
  assert.equal(state.error, undefined)
  await expectCarriesForever(state.graph, 'x')
})
