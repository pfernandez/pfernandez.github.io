import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { link } from './index.js'

const linked = (source, imports) => {
  const result = link(source, imports)
  if (result.error) throw result.error
  return result
}
const name = (legend, graph) => legend.get(graph)?.name
const capability = (legend, graph) => legend.get(graph)?.capability
const frames = frame => frame[1] === frame
  ? [frame[0]]
  : [frame[0], ...frames(frame[1])]
const inputs = call => frames(call[1][1])

describe('link', () => {
  test('retains the authored and decomposed trees', () => {
    const { ast, pairs } = linked('((I x x) (I a))')

    assert.deepEqual(ast, [['I', 'x', 'x'], ['I', 'a']])
    assert.deepEqual(pairs, [['I', ['x', 'x']], ['I', 'a']])
  })

  test('retains an inspectable connected artifact', () => {
    const { connected, graph, legend } = linked('((I x x) (I a))')
    const argument = connected.graph[1][1]

    assert.notEqual(connected.graph, graph)
    assert.equal(connected.legend.get(argument).name, 'a')
    assert.equal(argument.length, 1)
    assert.equal(argument[0], argument)
    assert.equal(name(legend, graph[1][0]), 'a')
    assert.equal(graph[1][0].length, 2)
  })

  test('links a top-level symbol as a fixed identity', () => {
    const bare = linked('x')
    const grouped = linked('(x)')

    assert.equal(bare.ast, 'x')
    assert.deepEqual(grouped.ast, ['x'])

    for (const { pairs, graph, focus, legend } of [bare, grouped]) {
      assert.equal(pairs, 'x')
      assert.equal(graph[0], graph)
      assert.equal(graph[1], graph)
      assert.equal(name(legend, graph), 'x')
      assert.equal(focus, graph)
      assert.equal(Object.isFrozen(graph), true)
    }
  })

  test('lets the first symbol name its pair', () => {
    const two = linked('(a b)')
    const three = linked('(a b c)')
    const four = linked('(a b c d)')

    assert.equal(name(two.legend, two.graph), 'a')
    assert.equal(two.graph[0], two.graph)
    assert.equal(name(two.legend, two.graph[1]), 'b')

    assert.equal(name(three.legend, three.graph), 'a')
    assert.equal(name(three.legend, three.graph[0]), 'b')
    assert.equal(name(three.legend, three.graph[1]), 'c')

    assert.equal(name(four.legend, four.graph), 'a')
    assert.equal(name(four.legend, four.graph[0]), 'b')
    assert.equal(name(four.legend, four.graph[1][0]), 'c')
    assert.equal(name(four.legend, four.graph[1][1]), 'd')
  })

  test('binds a named parameter pair as a whole and by state', () => {
    const { focus, legend } = linked(`
    ((F (x y z) x)
     (F (a b c)))
    `)
    const [args, result] = focus

    assert.equal(name(legend, args), 'a')
    assert.equal(name(legend, args[0]), 'b')
    assert.equal(name(legend, args[1]), 'c')
    assert.equal(result, args)
  })

  test('names a parameter pair inside a larger pattern', () => {
    const { focus, legend } = linked(`
    ((F ((x y z) appearance) x)
     (F ((a b c) ink)))
    `)
    const [args, result] = focus

    assert.equal(name(legend, args[0]), 'a')
    assert.equal(name(legend, args[1]), 'ink')
    assert.equal(result, args[0])
  })

  test('ties fix into a stable state', () => {
    const result = linked(`
    ((fix x (fix x))
     (fix a))
    `)
    const fixed = result.focus

    assert.equal(name(result.legend, fixed[0]), 'a')
    assert.equal(fixed[1], fixed)
  })

  test('exposes an observation while retaining its returning root', () => {
    const { focus, result } = linked(`
    ((root observation (root observation))
     (first (focus next) focus)
     (first (root view)))
    `)
    const [root, observation] = focus

    assert.equal(root[0], observation)
    assert.equal(root[1], root)
    assert.equal(result, observation)
  })

  test('names a fixed action as a recurring event', () => {
    const effect = () => {}
    const props = () => {}
    const linkedCall = linked(`
    ((fix x (fix x))
     (props
       (class action)
       (onclick (fix (effect Now)))))
    `, { effect, props })
    const call = linkedCall.focus
    const { legend } = linkedCall
    const event = inputs(call)[1]

    assert.equal(name(legend, event), 'onclick')
    assert.equal(capability(legend, event[0][0]), effect)
    assert.equal(event[1], event)
  })

  test('links imported names as existing identities', () => {
    const renderFunction = () => {}
    const headingFunction = () => {}
    const result = link('(render (h2 title))', {
      render: renderFunction,
      h2: headingFunction
    })
    if (result.error) throw result.error
    const renderCall = result.focus
    const render = renderCall[0]
    const heading = renderCall[1][1][0]
    const h2 = heading[0]
    const title = heading[1][1][0]

    assert.equal(capability(result.legend, render), renderFunction)
    assert.equal(render[0], render)
    assert.equal(render[1], render)
    assert.equal(capability(result.legend, h2), headingFunction)
    assert.equal(h2[0], h2)
    assert.equal(h2[1], h2)
    assert.equal(name(result.legend, title), 'title')
    assert.equal('results' in result, false)
    assert.equal('selections' in result, false)
  })

  test('gives flat and right-nested programs the same focus', () => {
    const flat = linked('((I x x) (K y y) (I a))')
    const nested = linked('((I x x) ((K y y) (I a)))')

    assert.deepEqual(flat.pairs, nested.pairs)
    assert.equal(flat.focus, flat.graph[1][1])
    assert.equal(nested.focus, nested.graph[1][1])
  })

  test('completes an application as arguments followed by result', () => {
    const { graph, focus: application, legend } = linked(
      '((I x x) (I a))')
    const [definition] = graph
    const [args, result] = application

    assert.equal(application.length, 2)
    assert.equal(application.includes(definition), false)
    assert.equal(name(legend, args), 'a')
    assert.equal(result, args)
    assert.equal(application[1], result)
  })

  test('exposes a result without discarding its application focus', () => {
    const { focus, result } = linked('((I x x) (I a))')

    assert.equal(result, focus[1])
    assert.notEqual(result, focus)
  })

  test('composes successive applications as sibling transitions', () => {
    const flat = linked('((I x x) (I a) (I b))')
    const nested = linked('((I x x) ((I a) (I b)))')
    const [first, second] = flat.graph[1]

    assert.equal(name(flat.legend, first[0]), 'a')
    assert.equal(first[1], first[0])
    assert.equal(name(flat.legend, second[0]), 'b')
    assert.equal(second[1], second[0])
    assert.equal(flat.focus, second)
    assert.equal(flat.result, second[1])
    assert.equal(name(nested.legend, nested.focus[0]), 'b')
    assert.equal(nested.result, nested.focus[1])
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
    const { graph, focus, legend } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b)))
    `)
    const [definition] = graph
    const suspension = graph[1]

    assert.equal(suspension[0], definition)
    assert.equal(suspension[1], focus)
    assert.equal(name(legend, focus[0]), 'a')
    assert.equal(name(legend, focus[1]), 'b')
  })

  test('resumes a suspended application', () => {
    const { graph, focus, legend } = linked(`
    ((S (x y z) ((x z) (y z)))
     ((S (a b)) c))
    `)
    const [definition] = graph
    const [args, result] = focus

    assert.notEqual(focus[0], definition)
    assert.equal(name(legend, args), 'a')
    assert.equal(name(legend, args[0]), 'b')
    assert.equal(name(legend, args[1]), 'c')
    assert.equal(result[0][0], args)
    assert.equal(result[0][1], args[1])
    assert.equal(result[1][0], args[0])
    assert.equal(result[1][1], args[1])
  })

  test('resumes a suspended application inside a definition', () => {
    const { graph, focus, legend } = linked(`
    ((S (x y z) ((x z) (y z)))
     (P f (f c))
     (P (S (a b))))
    `)
    const [S] = graph
    const [partial, application] = focus
    const [args, result] = application

    assert.equal(partial[0], S)
    assert.equal(name(legend, args), 'a')
    assert.equal(name(legend, args[0]), 'b')
    assert.equal(name(legend, args[1]), 'c')
    assert.equal(result[0][0], args)
    assert.equal(result[0][1], args[1])
    assert.equal(result[1][0], args[0])
    assert.equal(result[1][1], args[1])
  })

  test('does not continue from a non-callable result', () => {
    const { graph, focus, result, legend } = linked(`
    ((S (x y z) ((x z) (y z)))
     ((S (a b c)) d))
    `)
    const [first, second] = graph[1]
    const [args, applied] = first

    assert.equal(focus, second)
    assert.equal(result, undefined)
    assert.equal(name(legend, second), 'd')
    assert.equal(applied[0][0], args)
    assert.equal(applied[0][1], args[1])
    assert.equal(applied[1][0], args[0])
    assert.equal(applied[1][1], args[1])
  })

  test('binds an excess right-nested argument to the final parameter', () => {
    const { focus: application, legend } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c d)))
    `)
    const [args, result] = application
    const z = args[1]

    assert.equal(name(legend, z[0]), 'c')
    assert.equal(name(legend, z[1]), 'd')
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
    const { graph, focus, legend } = linked(`
    ((I x x)
     (F x
       ((G y y)
        (I x)))
     (render (F a)))
    `, { render })
    const F = graph[0][1][0]
    const history = graph[0][1][1]
    const application = history[0]
    const sequence = application[1]
    const local = sequence[0]
    const returned = sequence[1]

    assert.equal(name(legend, F), 'F')
    assert.equal(name(legend, local), 'G')
    assert.equal(name(legend, returned[1]), 'a')
    assert.equal(capability(legend, focus[0]), render)
    assert.equal(focus[1][1][0], returned[1])
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
    const { graph, focus, legend } = linked(`
    ((F x (G y x))
     ((F a) b))
    `)
    const F = graph[0]
    const first = graph[1][0]
    const closure = first[1]
    const [args, result] = focus

    assert.notEqual(closure, F[1])
    assert.equal(name(legend, closure), 'G')
    assert.equal(closure[1], first[0])
    assert.equal(name(legend, args), 'b')
    assert.equal(result, first[0])
  })

  test('applies a returned definition to a completed result', () => {
    const { focus, legend } = linked(`
    ((F x (G y x))
     (I x x)
     ((F a) (I b)))
    `)
    const [args, result] = focus

    assert.equal(name(legend, args), 'b')
    assert.equal(name(legend, result), 'a')
  })

  test('ties recurrence through a captured definition', () => {
    const { graph, focus: first, legend } = linked(`
    ((F x (G y (G x)))
     ((F a) b))
    `)
    const F = graph[0]
    const closure = graph[1][0][1]
    const second = first[1]

    assert.notEqual(closure, F[1])
    assert.equal(name(legend, first[0]), 'b')
    assert.equal(name(legend, second[0]), 'a')
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
    const { focus: first, legend } = linked(`
    ((app (x y) (app (y x)))
     (app (a b)))
    `)
    const second = first[1]
    const third = second[1]

    assert.equal(name(legend, first[0][0]), 'a')
    assert.equal(name(legend, first[0][1]), 'b')
    assert.equal(second[0][0], first[0][1])
    assert.equal(second[0][1], first[0][0])
    assert.equal(third, first)
  })

  test('ties a recursive transition directly into its orbit', () => {
    const { focus: initial, legend } = linked(`
    ((rotate (x y z) (rotate (y z x)))
     (rotate (a b c)))
    `)
    const first = initial[1]
    const second = first[1]
    const third = second[1]

    assert.equal(name(legend, initial[0]), 'a')
    assert.equal(name(legend, first[0]), 'b')
    assert.equal(name(legend, second[0]), 'c')
    assert.equal(third, initial)
  })

  test('ties separate recursive event branches', () => {
    const button = () => {}
    const { focus: initial, legend } = linked(`
    ((app x
       (button
         (onclick (app x))
         (onclick (app A))))
     (app B))
    `, { button })
    const [stay, reset] = inputs(initial)
    const resetBody = reset[1]
    const [resetStay, resetAgain] = inputs(resetBody)

    assert.equal(capability(legend, initial[0]), button)
    assert.equal(stay[1], initial)
    assert.equal(name(legend, reset[0]), 'A')
    assert.equal(capability(legend, resetBody[0]), button)
    assert.equal(resetStay[1][1], resetBody)
    assert.equal(resetAgain[1][1], resetBody)
  })

  test('returns graph and focus together when linking fails', () => {
    const { graph, focus, error } = link('(')

    assert.ok(error)
    assert.equal(focus, graph)
  })
})
