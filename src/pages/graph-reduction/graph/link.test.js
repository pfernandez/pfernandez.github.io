import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { link, step } from './index.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

describe('link', () => {
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

  test('copies a result while preserving shared argument identities', () => {
    const { graph, focus: application } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c)))
    `)
    const [definition] = graph
    const [args, result] = application

    assert.notEqual(result, definition[2])
    assert.equal(result[0][0], args[0])
    assert.equal(result[0][1], args[2])
    assert.equal(result[1][0], args[1])
    assert.equal(result[1][1], args[2])
  })

  test('leaves an undersupplied application pending', () => {
    const { graph, focus } = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b)))
    `)
    const [definition] = graph

    assert.equal(focus[0], definition)
    assert.equal(focus[1].length, 2)
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
    assert.equal(result[1][0], args[1])
    assert.equal(result[1][1], args[1])
  })

  test('ties a copied recursive application into a cycle', () => {
    const { focus } = linked(`
    ((Y f (f (Y f)))
     (Y a))
    `)
    const first = step(focus)
    const second = step(first)

    assert.equal(step(second), first)
  })

  test('returns graph and focus together when linking fails', () => {
    const { graph, focus, error } = link('(')

    assert.ok(error)
    assert.equal(focus, graph)
  })
})
