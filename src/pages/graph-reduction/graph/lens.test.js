import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { image } from '../wasm/image.js'
import { compile, observe, serialize } from './index.js'
import {
  event,
  historyDepth,
  output,
  previous,
  record,
  spineOutput,
  spineStep,
  step
} from './lens.js'

const select = node =>
  observe(node)[1]

const repeat = (form, fn, n) =>
  n === 0 ? form : repeat(fn(form), fn, n - 1)

describe('graph-native lens', () => {
  // A lens state is `[event, next]`. Runtime stepping follows the right edge.
  // Passive observation of the state exposes the stable event on the left.
  // The event carries `[previousEvent, output]`, so history is graph structure.
  //
  // This is hand-built for now: current Lisp can express a single boundary, but
  // not yet a clean prelinked chain whose next event reuses the prior event's
  // actual identity as a plain value.
  const withCounter = () => {
    let allocations = 0
    const pair = (left, right) => {
      allocations += 1
      return [left, right]
    }
    const atom = () => {
      const node = pair(null, null)
      node[0] = node
      node[1] = node
      return node
    }
    const event = (previous, output) => {
      const node = pair(null, pair(previous, output))
      node[0] = node
      return node
    }
    const state = (event, next = null) =>
      pair(event, next)

    return {
      atom,
      event,
      pair,
      state,
      allocations: () => allocations
    }
  }

  test('right-edge stepping can carry stable events on the left', () => {
    const graph = withCounter()
    const root = graph.atom()
    const firstOutput = graph.atom()
    const secondOutput = graph.atom()
    const thirdOutput = graph.atom()
    const firstEvent = graph.event(root, firstOutput)
    const secondEvent = graph.event(firstEvent, secondOutput)
    const thirdEvent = graph.event(secondEvent, thirdOutput)
    const first = graph.state(firstEvent)
    const second = graph.state(secondEvent)
    const third = graph.state(thirdEvent)

    first[1] = second
    second[1] = third
    third[1] = first

    const built = graph.allocations()

    assert.equal(observe(first), firstEvent)
    assert.equal(event(first), firstEvent)
    assert.equal(observe(step(first)), secondEvent)
    assert.equal(observe(step(step(first))), thirdEvent)
    assert.equal(step(step(step(first))), first)

    assert.equal(observe(firstEvent), firstEvent)
    assert.equal(output(firstEvent), firstOutput)
    assert.equal(output(secondEvent), secondOutput)
    assert.equal(output(thirdEvent), thirdOutput)
    assert.equal(historyDepth(thirdEvent, root), 3)

    let current = first
    for (let i = 0; i < 12; i += 1)
      current = step(current)

    assert.equal(graph.allocations(), built)
    assert.doesNotThrow(() => image(first))
  })

  test('source can name lens states and stable events', () => {
    const source = `
      (End (End End))
      (E0 (E0 (Root Out0)))
      (E1 (E1 (E0 Out1)))
      (E2 (E2 (E1 Out2)))
      (S2 (E2 End))
      (S1 (E1 S2))
      (S0 (E0 S1))
      S0
    `
    const { graph, legend } = compile(source)
    const firstEvent = observe(graph)
    const secondEvent = observe(step(graph))
    const thirdEvent = observe(step(step(graph)))

    assert.equal(serialize(graph, { legend }), '(E0 S1)')
    assert.equal(event(graph), firstEvent)
    assert.equal(output(firstEvent), output(firstEvent)[0])
    assert.equal(serialize(output(firstEvent), { legend }), 'Out0')
    assert.equal(serialize(output(secondEvent), { legend }), 'Out1')
    assert.equal(serialize(output(thirdEvent), { legend }), 'Out2')
    assert.equal(previous(secondEvent), firstEvent)
    assert.equal(previous(thirdEvent), secondEvent)
    assert.equal(serialize(step(step(step(graph))), { legend }), '(End End)')
    assert.doesNotThrow(() => image(graph))
  })

  test('lens fixture carries program-shaped outputs', () => {
    const source = readFileSync(new URL('../lens.lisp', import.meta.url))
    const { graph, legend } = compile(source.toString())
    const firstEvent = observe(graph)
    const secondEvent = observe(step(graph))

    assert.equal(serialize(graph, { legend }), '(E0 S1)')
    assert.equal(serialize(output(firstEvent), { legend }), '(((S a) b) c)')
    assert.equal(serialize(output(secondEvent), { legend }), '((a c) (b c))')
    assert.equal(previous(secondEvent), firstEvent)
    assert.equal(serialize(step(step(graph)), { legend }), '(End End)')
    assert.doesNotThrow(() => image(graph))
  })

  test('recorded observations replay without runtime allocation', () => {
    const source = `
      (S (((((x z) (y z)) x) y) z))
      (S a b c)
    `
    const compiled = compile(source)
    const outputs = []
    const answer = observe(compiled.graph, frame => outputs.push(frame))
    const lens = record([...outputs, answer[1]], {
      legend: compiled.legend
    })
    const built = lens.allocations
    const firstEvent = observe(lens.graph)
    const secondEvent = observe(step(lens.graph))
    const finalEvent = observe(step(step(step(step(lens.graph)))))

    assert.equal(serialize(lens.graph, { legend: lens.legend }),
                 '(E0 (E1 (E2 (E3 (E4 End)))))')
    assert.equal(output(firstEvent), compiled.graph)
    assert.equal(previous(secondEvent), firstEvent)
    assert.equal(serialize(output(finalEvent), { legend: lens.legend }),
                 '((a c) (b c))')

    let state = lens.graph
    for (let i = 0; i < 12; i += 1)
      state = step(state)

    assert.equal(lens.allocations, built)
    assert.doesNotThrow(() => image(lens.graph))
  })

  test('ordinary left spine already replays the observation path', () => {
    const { graph, legend } = compile(`
      (S (((((x z) (y z)) x) y) z))
      (S a b c)
    `)
    const frames = []
    const answer = observe(graph, frame => frames.push(frame))
    let state = graph

    for (const [i, frame] of frames.entries()) {
      assert.equal(state, frame)
      if (i < frames.length - 1)
        assert.equal(spineOutput(state), frame)
      state = spineStep(state)
    }

    assert.equal(state, answer)
    assert.equal(spineStep(state), answer)
    assert.equal(spineOutput(state), answer[1])
    assert.equal(serialize(spineOutput(state), { legend }), '((a c) (b c))')
    assert.doesNotThrow(() => image(graph))
  })

  test('source projections can drive encoded observer state', () => {
    const observer = focus => `
      (K ((x x) y))
      (False ((y x) y))
      (Pair ((((f x y) x) y) f))
      (First ((p K) p))
      (Second ((p False) p))
      (Tick (((Pair (Second focus) (Pair (First focus) history)) focus)
        history))
      (End (End End))
      (Frame2 (Pair Out2 End))
      (Frame1 (Pair Out1 Frame2))
      (Frame0 (Pair Out0 Frame1))
      ${focus}
    `
    const run = (focus, count = 4) => {
      const { graph, legend } = compile(observer(focus))
      return serialize(repeat(graph, select, count), { legend })
    }

    assert.equal(run('(First Frame0)', 3), 'Out0')
    assert.equal(run('(Second Frame0)', 3), '((Pair Out1) Frame2)')
    assert.equal(run('(First Frame1)', 3), 'Out1')
    assert.equal(run('(Second Frame1)', 3), '((Pair Out2) End)')
  })

  test('source projections do not inspect raw substrate cells', () => {
    const source = focus => `
      (K ((x x) y))
      (False ((y x) y))
      (Pair ((((f x y) x) y) f))
      (First ((p K) p))
      (Second ((p False) p))
      ${focus}
    `
    const run = (focus, count = 3) => {
      const { graph, legend } = compile(source(focus))
      return serialize(repeat(graph, select, count), { legend })
    }

    assert.equal(run('(First (Pair a b))'), 'a')
    assert.equal(run('(Second (Pair a b))'), 'b')
    assert.equal(run('(First (a b))'), 'a')
    assert.equal(run('(Second (a b))'), 'a')
  })

  test('observer fixture demonstrates source-level selection', () => {
    const source = readFileSync(new URL('../observer.lisp', import.meta.url))
    const { graph, legend } = compile(source.toString())

    assert.equal(serialize(repeat(graph, select, 3), { legend }), 'Out0')
  })

  test('root fixture carries dictionary and state to a question', () => {
    const source = readFileSync(new URL('../root.lisp', import.meta.url))
    const { graph, legend } = compile(source.toString())

    assert.equal(
      serialize(repeat(graph, select, 3), { legend }),
      '((a c) (b c))')
  })

  test('root can carry its own identity as question data', () => {
    const { graph, legend } = compile(`
      (K ((x x) y))
      (S (((((x z) (y z)) x) y) z))
      (Root ((((((question (Root)) K) S) state) state) question))
      (AskRoot (((((k root done) root) k) s) state))
      (Root seed AskRoot)
    `)

    assert.equal(
      serialize(repeat(graph, select, 3), { legend }),
      '((((((question Root) K) S) state) state) question)')
  })

  test('root question can select carried state', () => {
    const { graph, legend } = compile(`
      (K ((x x) y))
      (S (((((x z) (y z)) x) y) z))
      (Root ((((((question (Root)) K) S) state) state) question))
      (AskState (((((k state done) root) k) s) state))
      (Root seed AskState)
    `)

    assert.equal(serialize(repeat(graph, select, 3), { legend }), 'seed')
  })

  test('live root fixture steps a 2-bit register loop', () => {
    const source = readFileSync(new URL('../live-root.lisp', import.meta.url))
    const { graph, legend } = compile(source.toString())
    const values = []
    let state = graph

    assert.equal(serialize(output(observe(state)), { legend }), 'B00')
    assert.equal(serialize(output(observe(state)), { legend }), 'B00')

    for (let i = 0; i < 8; i += 1) {
      values.push(serialize(output(observe(state)), { legend }))
      state = step(state)
    }

    assert.deepEqual(values, [
      'B00',
      'B01',
      'B10',
      'B11',
      'B00',
      'B01',
      'B10',
      'B11'
    ])
    assert.equal(state, graph)
    assert.equal(serialize(output(observe(graph))[1], { legend }),
                 '(False False)')
    assert.equal(serialize(output(observe(step(step(graph))))[1], { legend }),
                 '(False True)')
    assert.doesNotThrow(() => image(graph))
  })

  test('fibonacci root fixture consumes a supplied register bank', () => {
    const source = readFileSync(
      new URL('../fibonacci-root.lisp', import.meta.url))
    const { graph, legend } = compile(source.toString())
    const named = symbol =>
      legend.find(entry => entry.symbol === symbol).node
    const True = named('True')
    const False = named('False')
    const bit = node =>
      node === True ? 1
        : node === False ? 0
          : assert.fail(`Unknown bit ${serialize(node, { legend })}`)
    const value = bits =>
      bit(bits[0]) + 2 * bit(bits[1][0]) + 4 * bit(bits[1][1])
    const values = []
    let state = graph

    for (let i = 0; i < 8; i += 1) {
      values.push(value(output(observe(state))[1]))
      state = step(state)
    }

    assert.deepEqual(values, [0, 1, 1, 2, 3, 5, 0, 5])
    assert.equal(
      output(observe(step(graph))),
      output(observe(step(step(graph)))))
    assert.equal(state, graph)
    assert.doesNotThrow(() => image(graph))
  })

  test('a finite cycle can unfold as an unbounded successor view', () => {
    const { graph, legend } = compile(`
      (Zero ((z z) s))
      (Succ ((((s m) m) z) s))
      (Forever (Succ Forever))
      Forever
    `)
    const Succ = graph[0]
    const Forever = graph[1]
    const depth = (node, limit) =>
      limit === 0 ? 0
        : node === Forever
          ? depth(node[1], limit)
        : node[0] === Succ
          ? 1 + depth(node[1], limit - 1)
          : 0

    assert.equal(serialize(graph, { legend }), '(Succ Forever)')
    assert.equal(graph[1][1], graph)
    assert.equal(depth(graph, 0), 0)
    assert.equal(depth(graph, 1), 1)
    assert.equal(depth(graph, 8), 8)
  })

  test('source can increment a supplied bit ledger without naming bits', () => {
    const source = `
      (I (x x))
      (True ((x x) y))
      (False ((y x) y))
      (Nil ((n n) c))
      (Cons (((((c h t) h) t) n) c))
      (Carry (((done (Cons False tail)) done) tail))
      (IncStep
        ((((h
            (t (done (Cons False (Cons True Nil)))
               (IncStep (Carry done)))
            (done (Cons True t)))
           done)
          h)
         t))
      (Inc (((bits (done (Cons True Nil)) (IncStep done)) bits) done))
    `
    const run = focus => {
      const { graph, legend } = compile(`${source}\n${focus}`)
      const named = symbol =>
        legend.find(entry => entry.symbol === symbol).node
      const symbols = {
        Cons: named('Cons'),
        False: named('False'),
        Nil: named('Nil'),
        True: named('True')
      }
      const isCons = node =>
        Array.isArray(node) && Array.isArray(node[0])
          && node[0][0] === symbols.Cons
      const settle = node => {
        for (let i = 0; i < 64; i += 1) {
          if (node === symbols.Nil || isCons(node)) return node
          node = select(node)
        }

        throw new Error('bit list did not settle')
      }
      const bits = node => {
        const list = settle(node)
        if (list === symbols.Nil) return ''

        const bit = list[0][1] === symbols.True ? '1'
          : list[0][1] === symbols.False ? '0'
            : '?'
        return bit + bits(list[1])
      }

      return bits(graph)
    }

    assert.equal(run('(Inc Nil I)'), '1')
    assert.equal(run('(Inc (Cons False Nil) I)'), '1')
    assert.equal(run('(Inc (Cons True Nil) I)'), '01')
    assert.equal(run('(Inc (Cons False (Cons True Nil)) I)'), '11')
    assert.equal(run('(Inc (Cons True (Cons True Nil)) I)'), '001')
  })
})
