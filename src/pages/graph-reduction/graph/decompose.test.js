import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decompose, parse } from './index.js'

test('decomposes sequences into right-nested pairs', () => {
  assert.deepEqual(
    decompose(parse('(a b c)')),
    ['a', ['b', 'c']])
})

test('treats flat and right-nested forms alike', () => {
  assert.deepEqual(
    decompose(parse('(a b c)')),
    decompose(parse('(a (b c))')))
})

test('preserves left nesting', () => {
  assert.deepEqual(
    decompose(parse('((a b) c)')),
    [['a', 'b'], 'c'])
})

test('collapses singleton grouping', () => {
  assert.equal(decompose(parse('(x)')), 'x')
})

test('leaves the authored tree unchanged', () => {
  const ast = parse('(a b c)')

  assert.deepEqual(decompose(ast), ['a', ['b', 'c']])
  assert.deepEqual(ast, ['a', 'b', 'c'])
})

test('produces only pairs', () => {
  const ast = parse('((I x x) (S (x y z) ((x z) (y z))))')
  const visit = node => {
    if (!Array.isArray(node)) return
    assert.equal(node.length, 2)
    node.forEach(visit)
  }

  visit(decompose(ast))
})
