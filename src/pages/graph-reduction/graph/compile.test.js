import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { compile, construct, encode, parse, serialize } from './index.js'
import { observe } from '../observer/observe.js'

const hasGraph = value =>
  value && typeof value === 'object' && Object.hasOwn(value, 'graph')

const graphOf = value => hasGraph(value) ? value.graph : value
const sequenceOf = value => hasGraph(value) ? value.sequence : []
const crossingsOf = value => hasGraph(value) ? value.crossings ?? [] : []

const serializeState = value =>
  serialize(graphOf(value), sequenceOf(value), crossingsOf(value))

const observeState = value =>
  ({ graph: observe(graphOf(value)),
     sequence: sequenceOf(value),
     crossings: crossingsOf(value) })

const observeUntilStable = (term, remaining = 32) => {
  const graph = graphOf(term)
  const next = observe(graph)
  if (next === graph) return term
  if (remaining <= 0) throw new Error('Expression did not settle')
  return observeUntilStable({ graph: next,
                              sequence: sequenceOf(term),
                              crossings: crossingsOf(term) },
                            remaining - 1)
}

const serializeTicks = (term, count) =>
  count <= 0 ? [] : [serializeState(term),
                     ...serializeTicks(observeState(term), count - 1)]

const settle = source =>
  serializeState(observeUntilStable(compile(source)))

const parseTerm = source => parse(source)[0]

const projection = source =>
  parseTerm(serializeState(compile(source)))

const encoded = source =>
  encode(parse(source))

const zPrelude = `
  (defn APPLY-SELF (x v) ((x x) v))
  (defn THETA (f x) (f (APPLY-SELF x)))
  (defn Z (f) ((THETA f) (THETA f)))
`

const zProgram = source =>
  `${zPrelude}\n${source}`

const loggedErrors = (t, actions) => {
  const { mock } = t.mock.method(console, 'error', () => {})
  actions.forEach(action => action())
  return mock.calls.map(call => call.arguments[0].message)
}

const assertCompileError = (t, source, pattern) => {
  const messages = loggedErrors(t, [() => compile(source)])
  assert.equal(messages.length, 1)
  assert.match(messages[0], pattern)
}


const assertFixedPayload = (point, value) => {
  assert.equal(point[0], point)
  assert.equal(point[1], value)
}

const assertSShape = graph => {
  const p0 = graph[0][0]
  const p1 = graph[1][0]
  const p2 = graph[0][1]

  assertFixedPayload(p0, 'a')
  assertFixedPayload(p1, 'b')
  assertFixedPayload(p2, 'c')
  assert.equal(graph[1][1], p2)
}

describe('compile', () => {
  test('compile returns () for blank programs', () => {
    assert.deepEqual(graphOf(compile('')), [])
    assert.deepEqual(graphOf(compile(' \n\t ')), [])
  })

  test('encode produces terms that construct can read', () => {
    const encoded = [[[[[0, 2], [1, 2]], 'a'], 'b'], 'c']
    const source = `
      (def S ((0 2) (1 2)))
      (((S a) b) c)
    `
    assert.deepEqual(encode(parse('')), [])
    assert.deepEqual(encode(parse('()')), [])
    assert.deepEqual(graphOf(construct([])), [])
    assert.deepEqual(encode([
      ['def', 'S', [[0, 2], [1, 2]]],
      ['S', 'a', 'b', 'c']
    ]), encoded)
    assert.deepEqual(encode(parse('(((((0 2) (1 2)) a) b) c)')), encoded)
    assert.equal(serializeState(construct(encoded)),
                 '(((((0 2) (1 2)) a) b) c)')
    assert.equal(serializeState(construct(encode(parse(source)))),
                 '(((((0 2) (1 2)) a) b) c)')
  })

  test('encode matches the serialized compile projection', () =>
    ['',
     '()',
     '(f x y)',
     '(defn I (x) x)\n(I a)',
     '(defn K (x y) x)\n((K a) b)',
     '(defn S (x y z) ((x z) (y z)))\n(((S a) b) c)',
     '(def S ((0 2) (1 2)))\n(((S a) b) c)',
     '(defn F (x) (x y))\n((F a) b)',
     '(defn APPLY-SELF (x v) ((x x) v))\n'
       + '(defn THETA (f x) (f (APPLY-SELF x)))\n'
       + '(defn Z (f) ((THETA f) (THETA f)))\n'
       + '(Z f)'].forEach(source =>
      assert.deepEqual(encoded(source), projection(source), source)))

  test('construct only needs the encoded term', () => {
    const source = '(defn I (x) x)\n(x (I a))'
    const state = compile(source)
    const rebuilt = construct(encoded(source))

    assert.equal(serializeState(rebuilt), serializeState(state))
    assert.equal(graphOf(state)[1][0], graphOf(state)[1])
    assert.equal(graphOf(rebuilt)[1], 'a')
  })

  test('construct leaves non-template applications ordinary', () => {
    assert.equal(graphOf(construct(['x'])), 'x')
    assert.equal(serializeState(construct(['f', 'x'])), '(f x)')
    assert.equal(serializeState(construct([[[2, 1], 'f'], 'x'])),
                 '(((2 1) f) x)')
  })

  test('construct rejects invalid numeric slots', () =>
    assert.throws(() => construct([[0, -1], 'a']), /non-negative integer/i))

  test('compile reads () as the final expression', () =>
    assert.deepEqual(graphOf(compile('()')), []))

  test('compile leaves atom-only programs unchanged', () => {
    assert.equal(graphOf(compile('name')), 'name')
    assert.equal(graphOf(compile('7')), 7)
    assert.equal(graphOf(compile('(name)')), 'name')
  })

  test('compile leaves unapplied functions as names', () =>
    assert.equal(serializeState(compile(`
      (defn I (x) x)
      I
    `)), 'I'))

  test('compile leaves unapplied non-template functions as names', () =>
    assert.equal(graphOf(compile(`
      (defn F (x) (x y))
      F
    `)), 'F'))

  test('compile preserves plain binary expressions', () =>
    assert.deepEqual(graphOf(compile('(((f x) y) z)')),
                     parseTerm('(((f x) y) z)')))

  test('compile left-associates n-ary applications', () =>
    assert.deepEqual(graphOf(compile('(f x y z)')),
                     parseTerm('(((f x) y) z)')))

  test('compile expands def aliases in applications', () =>
    assert.deepEqual(graphOf(compile(`
      (def I (() 0))
      (def id I)
      ((id a) b)
    `)), parseTerm('(((() 0) a) b)')))

  test('compile expands def aliases to atoms', () =>
    assert.equal(graphOf(compile(`
      (def answer value)
      answer
    `)), 'value'))

  test('function arguments become shared graph points', () => {
    const graph = graphOf(compile(`
      (defn S (x y z) ((x z) (y z)))
      (((S a) b) c)
    `))

    assertSShape(graph)
  })

  test('numeric templates build shared graph points', () => {
    const graph = graphOf(compile(`
      (def S ((0 2) (1 2)))
      (((S a) b) c)
    `))

    assertSShape(graph)
  })

  test('repeated slot numbers share one graph point', () => {
    const state = compile(`
      (def D (0 0))
      (D a)
    `)
    const graph = graphOf(state)

    assert.equal(graph[0], graph[1])
    assert.equal(graph[0][0], graph[0])
    assert.equal(graph[0][1], 'a')
    assert.equal(serializeState(state), '((0 0) a)')
  })

  test('one slot number can stand for the whole graph point', () => {
    const state = compile('(0 a)')
    const graph = graphOf(state)

    assert.equal(graph[0], graph)
    assert.equal(graph[1], 'a')
    assert.equal(serializeState(state), '(0 a)')
  })

  test('extra arguments stay after functions are filled', () => {
    const graph = graphOf(compile(`
      (defn I (x) x)
      ((I a) b)
    `))

    assert.equal(graph[0][0], graph[0])
    assert.equal(graph[0][1], 'a')
    assert.equal(graph[1], 'b')
  })

  test('unused function arguments do not reapply', () => {
    const state = compile(`
      (defn K (x y) x)
      ((K a) b)
    `)
    const graph = graphOf(state)

    assert.equal(graph[0], graph)
    assert.equal(graph[1], 'a')
    assert.equal(serializeState(state), '(0 a)')
  })

  test('higher-order definitions reduce through S K K', () =>
    assert.equal(settle(`
      (defn K (x y) x)
      (defn S (x y z) ((x z) (y z)))
      (((S K) K) a)
    `), 'a'))

  test('dynamic function bodies keep explicit argument points', () =>
    assert.equal(serializeState(compile(`
      (defn F (x) (x y))
      ((F a) b)
    `)), '(((0 y) b) a)'))

  test('compile expands empty function bodies to ()', () =>
    assert.equal(serializeState(compile(`
      (defn E (x) ())
      (E a)
    `)), '()'))

  test('extra arguments stay after numeric templates are filled', () =>
    assert.equal(serializeState(compile(`
      (def S ((0 2) (1 2)))
      ((((S a) b) c) d)
    `)), '((((((0 2) (1 2)) d) a) b) c)'))

  test('partial template applications stay ordinary', () => {
    assert.equal(serializeState(compile(`
      (defn S (x y z) ((x z) (y z)))
      (S a)
    `)), '(S a)')
    assert.equal(serializeState(compile(`
      (def S ((0 2) (1 2)))
      (S a)
    `)), '(S a)')
  })

  test('templates hidden in right branches still resolve', () =>
    assert.equal(serializeState(compile(`
      (defn I (x) x)
      (defn return-I (x) I)
      (x ((return-I q) a))
    `)), '(x a)'))

  test('compile keeps dynamic function bodies ordinary', () => {
    assert.equal(serializeState(compile(`
      (defn I (x) x)
      (defn F (x) (x y))
      ((I F) a)
    `)), '((0 y) a)')
    assert.equal(serializeState(compile(`
      (defn I (x) x)
      (defn F (x y) ((x y) z))
      (((I F) a) b)
    `)), '((((0 1) z) a) b)')
    assert.equal(serializeState(compile(`
      (defn I (x) x)
      (defn F (x y) (helper x))
      (((I F) a) b)
    `)), '(helper a)')
  })

  test('recursive-looking ordinary calls settle normally', () => {
    assert.equal(settle(`
      (defn STEP (self state) (self (state tick)))
      ((STEP f) seed)
    `), '(f (seed tick))')
    assert.equal(settle(`
      (defn I (x) x)
      (defn STEP (self state) (self (state tick)))
      (((I STEP) f) seed)
    `), '(f (seed tick))')
    assert.equal(settle(`
      (defn I (x) x)
      (defn STEP (self state other) (self (other tick)))
      ((((I STEP) f) seed) spare)
    `), '(f (spare tick))')
    assert.equal(settle(`
      (defn I (x) x)
      (defn STEP (self state) (self state))
      (((I STEP) f) seed)
    `), '(f seed)')
    assert.equal(settle(`
      (defn STEP (self state) (self (state tick)))
      (defn return-STEP (x) STEP)
      (((return-STEP q) f) seed)
    `), '(f (seed tick))')
  })

  test('compile lets parameters shadow definitions', () =>
    assert.equal(serializeState(compile(`
      (defn self (x) x)
      (defn F (self state) (self state))
      ((F f) seed)
    `)), '(((0 1) f) seed)'))

  test('Z keeps updating recursive state', () => {
    const ticks = serializeTicks(compile(zProgram(`
      (defn STEP (self state) (self (state tick)))
      ((Z STEP) seed)
    `)), 5)

    assert(ticks.every(tick => tick.includes('seed')))
    assert.equal(new Set(ticks).size, ticks.length)
  })

  test('Z carries visible state through recursive updates', () => {
    const ticks = serializeTicks(compile(zProgram(`
      (defn STEP (self state) (self ((state tick) tock)))
      ((Z STEP) seed)
    `)), 5)

    assert(ticks.every(tick => tick.includes('seed')))
    assert(ticks.some(tick => tick.includes('tick')))
    assert(ticks.some(tick => tick.includes('tock')))
    assert.equal(new Set(ticks).size, ticks.length)
  })

  test('fixed-point behavior does not depend on the name Z', () => {
    const renamed = serializeTicks(compile(`
      (defn U (x v) ((x x) v))
      (defn DELAY (f x) (f (U x)))
      (defn FIX (f) ((DELAY f) (DELAY f)))
      (defn STEP (self state) (self (state tick)))
      ((FIX STEP) seed)
    `), 4)
    const z = serializeTicks(compile(zProgram(`
      (defn STEP (self state) (self (state tick)))
      ((Z STEP) seed)
    `)), 4)

    assert.deepEqual(renamed, z)
  })

  test('serialize keeps passive recursive continuations finite', () => {
    const ticks = serializeTicks(compile(zProgram(`
      (defn STEP (self state) (self (next state)))
      ((Z STEP) seed)
    `)), 3)

    assert(ticks.every(tick => tick.includes('next')))
    assert(ticks.every(tick => tick.includes('seed')))
  })

  test('compile keeps nested self-application finite', () =>
    assert.equal(serializeState(compile(`
      (defn F (x) (x (x x)))
      (F F)
    `)), '((1 (1 1)) ((0 (0 (0 0))) 0))'))

  test('compile expands zero-argument defns', () =>
    assert.equal(graphOf(compile(`
      (defn answer () 42)
      answer
    `)), 42))

  test('compile clones repeated def expansions', () => {
    const tree = graphOf(compile(`
      (def pair-ab (a b))
      (pair-ab pair-ab)
    `))

    assert.deepEqual(tree, parseTerm('((a b) (a b))'))
    assert.notStrictEqual(tree[0], tree[1])
  })

  test('compile rejects programs without a final expression', t =>
    assertCompileError(t,
                       '(def I (() 0))',
                       /must end with an expression/i))

  test('compile rejects non-list defn params', t =>
    assertCompileError(t,
                       '(defn I x x)\n(I a)',
                       /params must be a list/i))

  test('compile rejects short def forms', t =>
    assertCompileError(t, '(def I)\nI', /def name body/i))

  test('compile rejects short defn forms', t =>
    assertCompileError(t, '(defn I (x))\n(I a)', /defn name/i))

  test('compile rejects non-symbol def names', t =>
    assertCompileError(t, '(def 0 a)\na', /def name must be a symbol/i))

  test('compile rejects non-symbol defn names', t =>
    assertCompileError(t,
                       '(defn 0 (x) x)\n(0 a)',
                       /defn name must be a symbol/i))

  test('compile rejects non-symbol defn params', t =>
    assertCompileError(t,
                       '(defn I (x 0) x)\n(I a)',
                       /params must be symbols/i))

  test('compile rejects sparse numeric slots', t =>
    assertCompileError(t,
                       '(def bad (0 2))\n(((bad a) b) c)',
                       /dense slots/i))

  test('compile rejects negative numeric slots', t =>
    assertCompileError(t,
                       '(def bad (0 -1))\n((bad a) b)',
                       /non-negative integer/i))

  test('compile rejects non-integer numeric slots', t =>
    assertCompileError(t,
                       '(def bad (0 1.5))\n((bad a) b)',
                       /non-negative integer/i))

  test('compile rejects recursive definitions', t =>
    assertCompileError(t,
                       '(def loop loop)\nloop',
                       /recursive definitions/i))

  test('compile rejects recursive function aliases in applications', t =>
    assertCompileError(t,
                       '(def loop loop)\n(loop a)',
                       /recursive definitions/i))
})
