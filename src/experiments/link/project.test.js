import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decompose } from '../../graph/decompose.js'
import { parse } from '../../graph/parse.js'
import { link } from './link.js'
import { project } from './project.js'

const view = (source, imports) =>
  project(link(decompose(parse(source)), imports))

test('passes the projected right value to a function on its left', () => {
  let received
  const inspect = value => {
    received = value
    return value
  }

  assert.equal(view('(inspect value)', { inspect }), 'value')
  assert.equal(received, 'value')
})

test('projects nested device calls from the authored graph', () => {
  const upper = value => value.toUpperCase()
  const wrap = value => `[${value}]`

  assert.equal(view('(wrap (upper word))', { upper, wrap }), '[WORD]')
})
