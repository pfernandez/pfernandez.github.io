import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { elements } from '@pfern/elements'
import { decompose } from '../../graph/decompose.js'
import { parse } from '../../graph/parse.js'
import { link } from './link.js'
import { project } from './project.js'

const source = readFileSync(
  new URL('./dashboard.lisp', import.meta.url),
  'utf-8'
)

test('projects the minimal authored dashboard into Elements data', () => {
  const render = value => value
  const graph = link(decompose(parse(source)), { render, ...elements })

  assert.deepEqual(
    project(graph),
    ['html', {},
     ['body', {},
      ['main', {},
       ['h2', {}, 'Dashboard']]]]
  )
})
