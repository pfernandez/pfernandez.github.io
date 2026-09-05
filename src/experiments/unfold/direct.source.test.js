import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from '../../graph/index.js'
import { assemble } from './assemble.js'
import { unfold } from './direct.js'

const source = readFileSync(
  new URL('./direct.lisp', import.meta.url),
  'utf8'
)

const program = () => assemble(parse(source)).names

test('returns a source-connected identity without a path', () => {
  const names = program()
  const result = unfold(names.get('return-A-root'))

  assert.equal(result[1][0], names.get('return-A'))
  assert.equal(result[1][1], names.get('A'))
})

test('grows source-authored history from its current root', () => {
  const names = program()
  const initial = names.get('remember-A-root')
  const first = unfold(initial)
  const second = unfold(first)

  assert.equal(first[1][1][0], initial)
  assert.equal(first[1][1][1], names.get('A'))
  assert.equal(second[1][1][0], first)
  assert.equal(second[1][1][1], names.get('A'))
})
