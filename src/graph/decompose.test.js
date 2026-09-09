import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decompose, parse } from './index.js'

test('decomposes sequences into right-nested pairs', () => {
  assert.deepEqual(
    decompose(parse('(a b c)')),
    ['a', ['b', 'c']])
})

test('treats flat and right-nested forms alike', () => {
  const flat = decompose(parse('(a b c)'))
  const nested = decompose(parse('(a ((b c)))'))

  assert.deepEqual(flat, nested)
  assert.equal(flat[1].sequence, true)
  assert.equal(nested[1].sequence, true)
})

test('preserves left nesting', () => {
  const pairs = decompose(parse('((a b) c)'))

  assert.deepEqual(pairs, [['a', 'b'], 'c'])
  assert.equal(pairs[0].sequence, undefined)
  assert.equal(pairs.sequence, undefined)
})

test('marks only pairs reached by proceeding right as sequences', () => {
  const pairs = decompose(parse('(a b c)'))

  assert.equal(pairs.sequence, undefined)
  assert.equal(pairs[1].sequence, true)
})

test('collapses singleton grouping', () => {
  assert.equal(decompose(parse('(x)')), 'x')
})

test('preserves authored self references', () => {
  assert.deepEqual(decompose(parse('(() x)')), [[], 'x'])
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
