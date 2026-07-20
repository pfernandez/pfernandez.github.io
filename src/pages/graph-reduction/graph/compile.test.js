import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  compile as compileProgram,
  observe,
  serialize as print
} from './index.js'

const legends = new WeakMap()

const remember = (node, legend, seen = new Set()) => {
  if (!Array.isArray(node) || seen.has(node)) return
  seen.add(node)
  legends.set(node, legend)
  remember(node[0], legend, seen)
  remember(node[1], legend, seen)
}

const compile = source => {
  const { graph, legend } = compileProgram(source)
  remember(graph, legend)
  return graph
}

const serialize = node =>
  print(node, { legend: legends.get(node) ?? [] })

const step = node => {
  const next = observe(node)[1]
  const legend = legends.get(node)
  if (legend) remember(next, legend)
  return next
}

const repeat = (form, fn, n) =>
  n === 0 ? form : repeat(fn(form), fn, n - 1)

const source = (definitions, focus) =>
  `${[definitions].flat().join('\n')}\n${focus}`

const assertReduction = (definitions, focus, result, steps = 1) =>
  assert.equal(
    serialize(repeat(compile(source(definitions, focus)), step, steps)),
    result)

const assertLoop = graph => {
  const yielded = step(graph)

  assert.notEqual(yielded, graph)
  assert.equal(repeat(graph, step, 2), graph)
  assert.equal(repeat(graph, step, 4), graph)
  assert.equal(repeat(graph, step, 6), graph)
  assert.equal(repeat(graph, step, 3), yielded)
  assert.equal(repeat(graph, step, 5), yielded)
}

const coreDefinitions = [
  '(I (x x))',
  '(K ((x x) y))',
  '(S (((((x z) (y z)) x) y) z))',
  '(B ((((f (g x)) f) g) x))',
  '(C ((((f y x) f) x) y))',
  '(W (((f x x) f) x))',
  '(M ((x x) x))',
  '(Y ((f (Y f)) f))',
  '(Loop (((step state (Loop step)) step) state))',
  '(Yield (((continue state) state) continue))',
  '(True ((x x) y))',
  '(False ((y x) y))',
  '(If ((((p x y) p) x) y))',
  '(Not ((p False True) p))',
  '(And (((p q False) p) q))',
  '(Or (((p True q) p) q))',
  '(Pair ((((f x y) x) y) f))',
  '(First ((p K) p))',
  '(Second ((p False) p))',
  '(Zero ((z z) s))',
  '(Succ ((((s m) m) z) s))',
  '(Nil ((n n) c))',
  '(Cons (((((c h t) h) t) n) c))',
  '(Head ((l no K) l))',
  '(LastGo (((t h LastGo) h) t))',
  '(Last ((l no LastGo) l))',
  '(LenStep (((Succ (t Zero LenStep)) h) t))',
  '(Length ((l Zero LenStep) l))',
  '(AddStep (((Succ (m2 n (AddStep n))) n) m2))',
  '(Add (((m n (AddStep n)) m) n))',
  '(MulStep (((Add n (m2 Zero (MulStep n))) n) m2))',
  '(Mul (((m Zero (MulStep n)) m) n))',
  '(Repeat ((Cons x (Repeat x)) x))',
  '(App (((p q) p) q))'
]

describe('true-shape compiler contracts', () => {
  test('definition slots are scoped identity', () => {
    const Dup = compile(source('(Dup ((x x) x))', 'Dup'))
    const x = Dup[1]

    assert.equal(Dup[0][0], x)
    assert.equal(Dup[0][1], x)
    assert.equal(x[0], x)
    assert.equal(x[1], Dup)
    assert.equal(
      serialize(step(compile(source('(Dup ((x x) x))', '(Dup a)')))),
      '(a a)')
  })

  test('definitions are pairs all the way down', () => {
    const K = compile(source('(K ((x x) y))', 'K'))
    const [body, y] = K
    const x = body[0]

    assert.equal(K.length, 2)
    assert.equal(body[1], x)
    assert.equal(x[0], x)
    assert.equal(x[1], K)
    assert.equal(y[0], y)
    assert.equal(y[1], K)
    assert.notEqual(x, y)
    assert.equal(observe(K)[1], K)
  })

  test('atoms are interned self-loops', () => {
    const graph = compile('(f a a)')
    const a = graph[1]

    assert.equal(graph[0][1], a)
    assert.equal(a[0], a)
    assert.equal(a[1], a)
    assert.equal(serialize(a), 'a')
  })

  test('observation is idempotent; selection reads the payload', () => {
    const found = observe(compile(source('(I (x x))', '(I a)')))

    assert.equal(found[0], found)
    assert.equal(observe(found), found)
    assert.equal(observe(observe(found)), found)
    assert.equal(serialize(found[1]), 'a')
  })

  test('bound heads are applications instead of new definitions', () =>
    assertReduction('(A (x x))', '(A y)', 'y'))

  test('later definitions tie earlier applications in bodies', () => {
    const graph = compile(source(
      ['(I (x x))', '(Use ((I y) y))'],
      '(Use a)'))
    const expanded = step(graph)

    assert.equal(serialize(expanded[1]), 'a')
    assert.equal(serialize(step(expanded)), 'a')
  })

  test('partial application does not create a stable redex', () => {
    const graph = compile(source('(K ((x x) y))', '(K a)'))

    assert.notEqual(graph[0], graph)
    assert.equal(serialize(graph[1]), 'a')
  })

  test('extra arguments remain after reduction', () =>
    assertReduction('(K ((x x) y))', '(K a b c)', '(a c)'))

  test('source applications build as left-nested applications', () => {
    const graph = compile('(let x y)')

    assert.equal(serialize(graph), '((let x) y)')
    assert.equal(serialize(step(graph)), 'let')
  })

  test('slotless bindings name raw values', () => {
    assert.equal(serialize(compile(source('(A (x))', 'A'))), 'x')
    assert.equal(serialize(compile(source('(K (x x y))', 'K'))), '((x x) y)')
  })

  test('compile rejects empty source', () => {
    assert.throws(
      () => compile(''),
      /Missing expression/)
  })

})

describe('core forms', () => {
  test('I returns its argument', () =>
    assertReduction('(I (x x))', '(I a)', 'a'))

  test('K returns its first argument', () =>
    assertReduction('(K ((x x) y))', '(K a b)', 'a'))

  test('S substitutes through both branches', () =>
    assertReduction(
      '(S (((((x z) (y z)) x) y) z))',
      '(S f g x)',
      '((f x) (g x))'))

  test('composed reductions share active calls', () =>
    assertReduction(coreDefinitions, '(S K K a)', 'a', 2))

  test('B composes functions', () =>
    assertReduction(coreDefinitions, '(B f g x)', '(f (g x))'))

  test('C exchanges arguments', () =>
    assertReduction(coreDefinitions, '(C f x y)', '((f y) x)'))

  test('W duplicates one argument', () =>
    assertReduction(coreDefinitions, '(W f x)', '((f x) x)'))

  test('M applies its argument to itself', () =>
    assertReduction(coreDefinitions, '(M x)', '(x x)'))

  test('Y keeps a named self-reference', () => {
    const graph = compile(source(coreDefinitions, '(Y f)'))
    const result = step(graph)
    const answer = graph[0]

    assert.equal(serialize(result[0]), 'f')
    assert.equal(result[1], graph)
    assert.equal(serialize(graph[1]), 'f')
    assert.equal(answer[0], answer)
    assert.equal(answer[1], result)
  })

  test('True returns its first branch', () =>
    assertReduction(coreDefinitions, '(True a b)', 'a'))

  test('False returns its second branch', () =>
    assertReduction(coreDefinitions, '(False a b)', 'b'))

  test('If applies the predicate to both branches', () =>
    assertReduction(coreDefinitions, '(If p a b)', '((p a) b)'))

  test('Pair sends both values to a receiver', () =>
    assertReduction(coreDefinitions, '(Pair a b f)', '((f a) b)'))

  test('First asks a pair to send values to K', () => {
    const result = step(compile(source(coreDefinitions, '(First p)')))
    const K = result[1]

    assert.equal(serialize(result[0]), 'p')
    assert.equal(K[1][1], K)
    assert.equal(K[0][1][1], K)
  })

  test('Second asks a pair to send values to False', () => {
    const result = step(compile(source(coreDefinitions, '(Second p)')))
    const False = result[1]

    assert.equal(serialize(result[0]), 'p')
    assert.equal(False[1][1], False)
    assert.equal(False[0][1][1], False)
  })

  test('Loop continues through a yielded continuation', () => {
    const graph = compile(source([
      '(Loop (((step state (Loop step)) step) state))',
      '(Yield (((continue state) state) continue))'
    ], '(Loop Yield seed)'))

    assertLoop(graph)
  })
})

describe('library forms', () => {
  test('data values settle at their constructors', () => {
    const Cons = serialize(compile(source(coreDefinitions, 'Cons')))
    const Succ = serialize(compile(source(coreDefinitions, 'Succ')))

    assert.equal(
      serialize(repeat(
        compile(source(coreDefinitions, '(Cons a Nil)')),
        step,
        1)),
      Cons)
    assert.equal(
      serialize(repeat(
        compile(source(coreDefinitions, '(Succ Zero)')),
        step,
        1)),
      Succ)
  })

  test('case analysis completes a partial constructor', () =>
    assertReduction(
      coreDefinitions,
      '(Head (Cons a (Cons b Nil)))',
      'a',
      3))

  test('structural recursion settles on closed data', () =>
    assertReduction(
      coreDefinitions,
      '(Last (Cons a (Cons b Nil)))',
      'b',
      6))

  test('arithmetic computes through Scott numerals', () => {
    const count = (node, cap = 64) => {
      const Succ = serialize(compile(source(coreDefinitions, 'Succ')))
      const Zero = serialize(compile(source(coreDefinitions, 'Zero')))

      while (cap--) {
        if (Array.isArray(node) && serialize(node[0]) === Succ)
          return 1 + count(node[1])
        if (serialize(node) === Zero) return 0
        node = step(node)
      }

      throw new Error('not a numeral')
    }

    assert.equal(count(compile(source(
      coreDefinitions,
      '(Add (Succ Zero) (Succ Zero))'))), 2)
    assert.equal(count(compile(source(
      coreDefinitions,
      '(Add (Succ (Succ Zero)) (Succ Zero))'))), 3)
    assert.equal(count(compile(source(
      coreDefinitions,
      '(Mul (Succ (Succ Zero)) (Succ (Succ Zero)))'))), 4)
    assert.equal(count(compile(source(
      coreDefinitions,
      '(Length (Cons a (Cons b Nil)))'))), 2)
  })

  test('open data leaves a symbolic residual', () => {
    const graph = compile(source(coreDefinitions, '(Add m (Succ Zero))'))

    assert.match(serialize(step(graph)), /^\(\(m /)
    assert.equal(serialize(repeat(graph, step, 2)), 'm')
  })

  test('an active call makes infinite data finite', () => {
    const Cons = serialize(compile(source(coreDefinitions, 'Cons')))

    assertReduction(coreDefinitions, '(Repeat a no K)', 'a', 3)
    assert.equal(
      serialize(repeat(
        compile(source(coreDefinitions, '(Repeat a)')),
        step,
        2)),
      Cons)
  })

  test('a computed answer in head position remains callable', () => {
    assertReduction(coreDefinitions, '(App I a)', 'a', 2)
    assertReduction(coreDefinitions, '(App (I I) a)', 'a', 2)
    assertReduction(coreDefinitions, '((I I) a)', 'a', 2)
    assertReduction(coreDefinitions, '(App (K I x) a)', 'a', 2)
    assertReduction(coreDefinitions, '(App (I (K a)) b)', 'a', 2)
    assertReduction(coreDefinitions, '(App (I (S K K)) a)', 'a', 3)
    assertReduction(coreDefinitions, '((If True I K) a b)', 'a', 4)
    assertReduction(coreDefinitions, '((If False K I) a b)', 'a', 4)
    assertReduction(coreDefinitions, '((First (Pair I K)) a)', 'a', 4)
    assertReduction(coreDefinitions, '((Second (Pair I K)) a b)', 'a', 4)
  })

  test('forward references do not bind', () =>
    assert.equal(
      serialize(repeat(
        compile('(A ((B x) x))\n(B (y y))\n(A k)'),
        step,
        2)),
      'B'))
})
