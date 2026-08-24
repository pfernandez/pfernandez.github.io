import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { link } from './index.js'

const linked = (source, imports) => {
  const result = link(source, imports)
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

  test('lets the first symbol name its pair', () => {
    const two = linked('(a b)').graph
    const three = linked('(a b c)').graph
    const four = linked('(a b c d)').graph

    assert.equal(two['symbol'], 'a')
    assert.equal(two[0], two)
    assert.equal(two[1]['symbol'], 'b')

    assert.equal(three['symbol'], 'a')
    assert.equal(three[0]['symbol'], 'b')
    assert.equal(three[1]['symbol'], 'c')

    assert.equal(four['symbol'], 'a')
    assert.equal(four[0]['symbol'], 'b')
    assert.equal(four[1][0]['symbol'], 'c')
    assert.equal(four[1][1]['symbol'], 'd')
  })

  test('binds a named parameter pair as a whole and by state', () => {
    const { focus } = linked(`
    ((F (x y z) x)
     (F (a b c)))
    `)
    const [args, result] = focus

    assert.equal(args['symbol'], 'a')
    assert.equal(args[0]['symbol'], 'b')
    assert.equal(args[1]['symbol'], 'c')
    assert.equal(result, args)
  })

  test('names a parameter pair inside a larger pattern', () => {
    const { focus } = linked(`
    ((F ((x y z) appearance) x)
     (F ((a b c) ink)))
    `)
    const [args, result] = focus

    assert.equal(args[0]['symbol'], 'a')
    assert.equal(args[1]['symbol'], 'ink')
    assert.equal(result, args[0])
  })

  test('ties fix into a stable state', () => {
    const fixed = linked(`
    ((fix x (fix x))
     (fix a))
    `).focus

    assert.equal(fixed[0]['symbol'], 'a')
    assert.equal(fixed[1], fixed)
  })

  test('links imported names as existing identities', () => {
    const renderFunction = () => {}
    const headingFunction = () => {}
    const result = link('(render (h2 title))', {
      render: renderFunction,
      h2: headingFunction
    })
    if (result.error) throw result.error
    const [render, heading] = result.graph
    const [h2, title] = heading

    assert.equal(render['symbol'], renderFunction)
    assert.equal(render[0], render)
    assert.equal(render[1], render)
    assert.equal(h2['symbol'], headingFunction)
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
    assert.equal(application[1], result)
  })

  test('exposes a result without discarding its application focus', () => {
    const { focus, result } = linked('((I x x) (I a))')

    assert.equal(result, focus[1])
    assert.notEqual(result, focus)
  })

  test('does not introduce an unused argument into the result', () => {
    const { focus: application } = linked(`
    ((K (x y) x)
     (K (a b)))
    `)
    const [args, result] = application

    assert.equal(result, args[0])
    assert.notEqual(result, args[1])
  })

  test('builds a result while preserving shared argument identities', () => {
    const { graph, focus: application } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c)))
    `)
    const [definition] = graph
    const [args, result] = application

    assert.notEqual(result, definition[1])
    assert.equal(result[0][0], args)
    assert.equal(result[0][1], args[1])
    assert.equal(result[1][0], args[0])
    assert.equal(result[1][1], args[1])
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
    assert.equal(args['symbol'], 'a')
    assert.equal(args[0]['symbol'], 'b')
    assert.equal(args[1]['symbol'], 'c')
    assert.equal(result[0][0], args)
    assert.equal(result[0][1], args[1])
    assert.equal(result[1][0], args[0])
    assert.equal(result[1][1], args[1])
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
    assert.equal(args['symbol'], 'a')
    assert.equal(args[0]['symbol'], 'b')
    assert.equal(args[1]['symbol'], 'c')
    assert.equal(result[0][0], args)
    assert.equal(result[0][1], args[1])
    assert.equal(result[1][0], args[0])
    assert.equal(result[1][1], args[1])
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
    assert.equal(result[0][0], args)
    assert.equal(result[0][1], args[1])
    assert.equal(result[1][0], args[0])
    assert.equal(result[1][1], args[1])
  })

  test('binds an excess right-nested argument to the final parameter', () => {
    const { focus: application } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c d)))
    `)
    const [args, result] = application
    const z = args[1]

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

  test('completes an application exposed by a parameter', () => {
    const { focus } = linked(`
    ((I x x)
     (A (x unused f) (f x))
     (A (a b I)))
    `)
    const [args, result] = focus

    assert.equal(result[0], args)
    assert.equal(result[1], args)
  })

  test('passes a result focus while retaining its definition sequence', () => {
    const render = () => {}
    const { graph, focus } = linked(`
    ((I x x)
     (F x
       ((G y y)
        (I x)))
     (render (F a)))
    `, { render })
    const F = graph[1][0]
    const history = graph[1][1]
    const application = history[0]
    const sequence = application[1]
    const local = sequence[0]
    const returned = sequence[1]

    assert.equal(F['symbol'], 'F')
    assert.equal(local['symbol'], 'G')
    assert.equal(returned[1]['symbol'], 'a')
    assert.equal(focus[0]['symbol'], render)
    assert.equal(focus[1], returned[1])
  })

  test('keeps application bindings local', () => {
    const { focus } = linked(`
    ((I x x)
     (A (x y f) ((f x) (f y)))
     (A (a b I)))
    `)
    const [args, result] = focus

    assert.equal(result[0][0], args)
    assert.equal(result[0][1], args)
    assert.equal(result[1][0], args[0])
    assert.equal(result[1][1], args[0])
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
    const second = first[1]

    assert.notEqual(closure, F[1])
    assert.equal(first[0]['symbol'], 'b')
    assert.equal(second[0]['symbol'], 'a')
    assert.equal(second[1], second)
  })

  test('carries a later definition through a recursive library', () => {
    const { graph, focus } = linked(`
    ((fix x (fix x))
     (library (state entry)
       (fix ((entry state) (library (state entry)))))
     (flip (x y) (y x))
     (library ((a b) flip)))
    `)
    const flip = graph[1][1][0]
    const [args, fixed] = focus
    const [state, entry] = args
    const [value, recurrence] = fixed
    const [application, recursive] = value
    const [applied, result] = application

    assert.equal(entry, flip)
    assert.equal(applied, state)
    assert.equal(result[0], state[1])
    assert.equal(result[1], state[0])
    assert.equal(recursive, focus)
    assert.equal(recurrence, fixed)
  })

  test('ties an instantiated recursive application into a cycle', () => {
    const { graph, focus } = linked(`
    ((Y f (f (Y f)))
     (Y a))
    `)
    const [definition] = graph
    const first = focus[1]
    const second = first[1]

    assert.notEqual(focus[0], definition)
    assert.equal(first[0], focus[0])
    assert.equal(second[1], first)
  })

  test('ties guarded recurrence through successive states', () => {
    const { focus: first } = linked(`
    ((app (x y) (app (y x)))
     (app (a b)))
    `)
    const second = first[1]
    const third = second[1]

    assert.equal(first[0][0]['symbol'], 'a')
    assert.equal(first[0][1]['symbol'], 'b')
    assert.equal(second[0][0], first[0][1])
    assert.equal(second[0][1], first[0][0])
    assert.equal(third, first)
  })

  test('ties a recursive transition directly into its orbit', () => {
    const { focus: initial } = linked(`
    ((rotate (x y z) (rotate (y z x)))
     (rotate (a b c)))
    `)
    const first = initial[1]
    const second = first[1]
    const third = second[1]

    assert.equal(initial[0]['symbol'], 'a')
    assert.equal(first[0]['symbol'], 'b')
    assert.equal(second[0]['symbol'], 'c')
    assert.equal(third, initial)
  })

  test('ties separate recursive event branches', () => {
    const button = () => {}
    const { focus: initial } = linked(`
    ((app x
       (button
         (onclick (app x))
         (onclick (app A))))
     (app B))
    `, { button })
    const body = initial[1]
    const [stay, reset] = body[1]
    const resetBody = reset[1]
    const [resetStay, resetAgain] = resetBody[1]

    assert.equal(body[0]['symbol'], button)
    assert.equal(initial[0]['symbol'], 'B')
    assert.equal(stay, initial)
    assert.equal(reset[0]['symbol'], 'A')
    assert.equal(resetBody[0]['symbol'], button)
    assert.equal(resetStay, reset)
    assert.equal(resetAgain, reset)
  })

  test('returns graph and focus together when linking fails', () => {
    const { graph, focus, error } = link('(')

    assert.ok(error)
    assert.equal(focus, graph)
  })
})
