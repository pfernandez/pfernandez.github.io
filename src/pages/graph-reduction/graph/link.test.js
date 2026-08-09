import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { link, step } from './index.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result.graph
}

describe('link', () => {
  test('completes an application as arguments followed by result', () => {
    const graph = linked('((I x x) (I a))')
    const [definition, application] = graph
    const [args, result] = application

    assert.equal(application.length, 2)
    assert.equal(application.includes(definition), false)
    assert.equal(args['symbol'], 'a')
    assert.equal(result, args)
    assert.equal(step(application), result)
  })

  test('copies a result while preserving shared argument identities', () => {
    const graph = linked(`
    ((S (x y z) ((x z) (y z)))
     (S (a b c)))
    `)
    const [definition, application] = graph
    const [args, result] = application

    assert.notEqual(result, definition[2])
    assert.equal(result[0][0], args[0])
    assert.equal(result[0][1], args[2])
    assert.equal(result[1][0], args[1])
    assert.equal(result[1][1], args[2])
  })
})
