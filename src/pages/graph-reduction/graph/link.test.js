import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { link, step } from './index.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

describe('link', () => {
  test('retains the authored and decomposed trees', () => {
    const { ast, pairs } = linked('((I x x) (I a))')

    assert.deepEqual(ast, [['I', 'x', 'x'], ['I', 'a']])
    assert.deepEqual(pairs, [['I', ['x', 'x']], ['I', 'a']])
  })

  test('links a top-level symbol as a fixed identity', () => {
    const bare = linked('x')
    const grouped = linked('(x)')

    assert.equal(bare.ast, 'x')
    assert.deepEqual(grouped.ast, ['x'])

    for (const { pairs, graph, focus } of [bare, grouped]) {
      assert.equal(pairs, 'x')
      assert.equal(graph[0], graph)
      assert.equal(graph[1], graph)
      assert.equal(graph['symbol'], 'x')
      assert.equal(focus, graph)
      assert.equal(Object.isFrozen(graph), true)
    }
  })

  test('requires a pair around a self reference', () => {
    const { error } = link('()')

    assert.match(error.message, /Self reference has no enclosing pair/)
  })

  test('links two self references into an anonymous atom', () => {
    const { graph, focus } = linked('(() ())')

    assert.equal(focus, graph)
    assert.equal(graph[0], graph)
    assert.equal(graph[1], graph)
  })

  test('uses hold recurrence and a self reference equivalently', () => {
    const recursive = linked(`
    ((hold x (hold x))
     (hold a))
    `).focus
    const literalApplication = linked(`
    ((hold x (x ()))
     (hold a))
    `).focus
    const literal = step(literalApplication)

    assert.notEqual(literalApplication, literal)
    assert.equal(recursive[1], recursive)
    assert.equal(literal[1], literal)
    assert.deepEqual(literal, recursive)
  })

  test('links imported names as existing identities', () => {
    const result = link('(render (h2 title))', ['render', 'h2'])
    if (result.error) throw result.error
    const [render, heading] = result.graph
    const [h2, title] = heading

    assert.equal(render['symbol'], 'render')
    assert.equal(render[0], render)
    assert.equal(render[1], render)
    assert.equal(h2['symbol'], 'h2')
    assert.equal(h2[0], h2)
    assert.equal(h2[1], h2)
    assert.equal(title['symbol'], 'title')
  })

  test('gives flat and right-nested programs the same focus', () => {
    const flat = linked('((I x x) (K y y) (I a))')
    const nested = linked('((I x x) ((K y y) (I a)))')

    assert.deepEqual(flat.pairs, nested.pairs)
    assert.equal(flat.focus, flat.graph[1][1])
    assert.equal(nested.focus, nested.graph[1][1])
  })

  test('completes an application as arguments followed by result', () => {
    const { graph, focus: application } = linked('((I x x) (I a))')
    const [definition] = graph
    const [args, result] = application

    assert.equal(application.length, 2)
    assert.equal(application.includes(definition), false)
    assert.equal(args['symbol'], 'a')
    assert.equal(result, args)
    assert.equal(step(application), result)
  })

  test('does not copy an unused argument into the result', () => {
    const { focus: application } = linked(`
    ((K (x y) x)
     (K (a b)))
    `)
    const [args, result] = application

    assert.equal(result, args[0])
    assert.notEqual(result, args[1])
  })

  test('copies a result while preserving shared argument identities', () => {
    const { graph, focus: application } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c)))
    `)
    const [definition] = graph
    const [args, result] = application

    assert.notEqual(result, definition[1])
    assert.equal(result[0][0], args[0])
    assert.equal(result[0][1], args[1][1])
    assert.equal(result[1][0], args[1][0])
    assert.equal(result[1][1], args[1][1])
  })

  test('crystallizes an undersupplied application as its causal prefix', () => {
    const { graph, focus } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b)))
    `)
    const [definition] = graph
    const suspension = graph[1]

    assert.equal(suspension[0], definition)
    assert.equal(suspension[1], focus)
    assert.equal(focus[0]['symbol'], 'a')
    assert.equal(focus[1]['symbol'], 'b')
  })

  test('resumes a suspended application', () => {
    const { graph, focus } = linked(`
    ((S (x y z) ((x z) (y z)))
     ((S (a b)) c))
    `)
    const [definition] = graph
    const [args, result] = focus

    assert.notEqual(focus[0], definition)
    assert.equal(args[0]['symbol'], 'a')
    assert.equal(args[1][0]['symbol'], 'b')
    assert.equal(args[1][1]['symbol'], 'c')
    assert.equal(result[0][0], args[0])
    assert.equal(result[0][1], args[1][1])
    assert.equal(result[1][0], args[1][0])
    assert.equal(result[1][1], args[1][1])
  })

  test('resumes a suspended application inside a definition', () => {
    const { graph, focus } = linked(`
    ((S (x y z) ((x z) (y z)))
     (P f (f c))
     (P (S (a b))))
    `)
    const [S] = graph
    const [partial, application] = focus
    const [args, result] = application

    assert.equal(partial[0], S)
    assert.equal(args[0]['symbol'], 'a')
    assert.equal(args[1][0]['symbol'], 'b')
    assert.equal(args[1][1]['symbol'], 'c')
    assert.equal(result[0][0], args[0])
    assert.equal(result[0][1], args[1][1])
    assert.equal(result[1][0], args[1][0])
    assert.equal(result[1][1], args[1][1])
  })

  test('continues from the result of a completed application', () => {
    const { graph, focus: second } = linked(`
    ((S (x y z) ((x z) (y z)))
     ((S (a b c)) d))
    `)
    const [first] = graph[1]
    const [args, result] = first

    assert.equal(graph[1][1], second)
    assert.equal(second[0], result)
    assert.equal(second[1]['symbol'], 'd')
    assert.equal(result[0][0], args[0])
    assert.equal(result[0][1], args[1][1])
    assert.equal(result[1][0], args[1][0])
    assert.equal(result[1][1], args[1][1])
    assert.equal(step(graph[1]), second)
  })

  test('binds an excess right-nested argument to the final parameter', () => {
    const { focus: application } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c d)))
    `)
    const [args, result] = application
    const z = args[1][1]

    assert.equal(z[0]['symbol'], 'c')
    assert.equal(z[1]['symbol'], 'd')
    assert.equal(result[0][1], z)
    assert.equal(result[1][1], z)
  })

  test('matches explicitly nested parameter and argument shapes', () => {
    const { focus } = linked(`
    ((F ((x y) z) (x z))
     (F ((a b) c)))
    `)
    const [args, result] = focus

    assert.equal(result[0], args[0][0])
    assert.equal(result[1], args[1])
  })

  test('completes an application created by copying', () => {
    const { focus } = linked(`
    ((I x x)
     (A (x unused f) (f x))
     (A (a b I)))
    `)
    const [args, result] = focus

    assert.equal(result[0], args[0])
    assert.equal(result[1], args[0])
  })

  test('keeps copied application bindings local', () => {
    const { focus } = linked(`
    ((I x x)
     (A (x y f) ((f x) (f y)))
     (A (a b I)))
    `)
    const [args, result] = focus

    assert.equal(result[0][0], args[0])
    assert.equal(result[0][1], args[0])
    assert.equal(result[1][0], args[1][0])
    assert.equal(result[1][1], args[1][0])
  })

  test('applies a returned definition with its lexical bindings', () => {
    const { graph, focus } = linked(`
    ((F x (G y x))
     ((F a) b))
    `)
    const F = graph[0]
    const first = graph[1][0]
    const closure = first[1]
    const [args, result] = focus

    assert.notEqual(closure, F[1])
    assert.equal(closure['symbol'], 'G')
    assert.equal(closure[1], first[0])
    assert.equal(args['symbol'], 'b')
    assert.equal(result, first[0])
  })

  test('ties recurrence through a captured definition', () => {
    const { graph, focus: first } = linked(`
    ((F x (G y (G x)))
     ((F a) b))
    `)
    const F = graph[0]
    const closure = graph[1][0][1]
    const second = step(first)

    assert.notEqual(closure, F[1])
    assert.equal(first[0]['symbol'], 'b')
    assert.equal(second[0]['symbol'], 'a')
    assert.equal(step(second), second)
  })

  test('ties a copied recursive application into a cycle', () => {
    const { graph, focus } = linked(`
    ((Y f (f (Y f)))
     (Y a))
    `)
    const [definition] = graph
    const first = step(focus)
    const second = step(first)

    assert.notEqual(focus[0], definition)
    assert.equal(first[0], focus[0])
    assert.equal(step(second), first)
  })

  test('ties guarded recurrence through successive states', () => {
    const { focus: first } = linked(`
    ((app (x y) (app (y x)))
     (app (a b)))
    `)
    const second = step(first)
    const third = step(second)

    assert.equal(first[0][0]['symbol'], 'a')
    assert.equal(first[0][1]['symbol'], 'b')
    assert.equal(second[0][0], first[0][1])
    assert.equal(second[0][1], first[0][0])
    assert.equal(third, first)
  })

  test('constructs the unique states of an authored observer', () => {
    const { focus: initial } = linked(`
    ((next (x y) (y x))
     (observe state (observe (next state)))
     (observe (a b)))
    `)
    const first = step(initial)
    const second = step(first)

    assert.equal(initial[0][0]['symbol'], 'a')
    assert.equal(initial[0][1]['symbol'], 'b')
    assert.equal(first[0][0], initial[0][1])
    assert.equal(first[0][1], initial[0][0])
    assert.notEqual(second, initial)
    assert.equal(second[0][0], initial[0][0])
    assert.equal(second[0][1], initial[0][1])
    assert.equal(step(second), first)
  })

  test('returns graph and focus together when linking fails', () => {
    const { graph, focus, error } = link('(')

    assert.ok(error)
    assert.equal(focus, graph)
  })
})
