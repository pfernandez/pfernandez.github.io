import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parse } from './index.js'

const loggedErrors = (t, actions) => {
  const { mock } = t.mock.method(console, 'error', () => {})
  actions.forEach(action => action())
  return mock.calls.map(call => call.arguments[0].message)
}

describe('source parser', () => {
  test('parse returns no forms for blank input', () => {
    assert.deepEqual(parse(''), [])
    assert.deepEqual(parse('   \n\t'), [])
  })

  test('parse returns symbol and number atoms', () => {
    assert.deepEqual(parse('foo'), ['foo'])
    assert.deepEqual(parse('42'), [42])
    assert.deepEqual(parse('-3'), [-3])
    assert.deepEqual(parse('3.14'), [3.14])
  })

  test('parse reads () as one empty-list form', () =>
    assert.deepEqual(parse('()'), [[]]))

  test('parse reads binary lists', () =>
    assert.deepEqual(parse('(a b)'), [['a', 'b']]))

  test('parse preserves nested binary lists', () => assert.deepEqual(
    parse('((() a) (b (c ())))'), [[[[], 'a'], ['b', ['c', []]]]]))

  test('parse ignores line breaks', () => assert.deepEqual(
    parse('\n(\na\n(\n(\n)\nb\n)\n)\n'), [['a', [[], 'b']]]))

  test('parse ignores comments', () => {
    assert.deepEqual(parse('; comment\n(a b)'), [['a', 'b']])
    assert.deepEqual(parse('(a ; inline\n b)'), [['a', 'b']])
  })

  test('parse preserves n-ary lists and top-level order', () => {
    assert.deepEqual(parse('(x)'), [['x']])
    assert.deepEqual(parse('(a b c)'), [['a', 'b', 'c']])
    assert.deepEqual(parse('a b'), ['a', 'b'])
    assert.deepEqual(parse('(() x) y'), [[[], 'x'], 'y'])
  })

  test('parse reports malformed parentheses', t => {
    const messages = loggedErrors(t, [
      () => parse(')'),
      () => parse('('),
      () => parse('(a'),
      () => parse('(a b')
    ])

    assert.equal(messages.length, 4)
    assert.match(messages[0], /Unexpected \)/i)
    assert(messages.slice(1).every(message => /Missing \)/i.test(message)))
  })
})
