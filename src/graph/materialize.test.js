import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose } from './compose.js'
import { connect } from './connect.js'
import { decompose } from './decompose.js'
import { materialize } from './materialize.js'
import { parse } from './parse.js'

const compile = (source, imports = {}) => materialize(
  compose(connect(decompose(parse(source)), imports))
)

const args = frame => frame[1] === frame
  ? [frame[0]]
  : [frame[0], ...args(frame[1])]

test('places capability arguments in recurrent frames', () => {
  const collect = () => {}
  const { focus, legend } = compile(`
    ((A A)
     (B B)
     (collect A B))
  `, { collect })

  assert.equal(legend.get(focus[0]).capability, collect)
  assert.deepEqual(
    args(focus[1][1]).map(value => legend.get(value).name),
    ['A', 'B'])
  assert.equal(focus[1][0], focus[1])
  assert.equal(focus[1][1][1][1], focus[1][1][1])
})

test('exposes a completed application as one device argument', () => {
  const collect = () => {}
  const effect = () => {}
  const { graph, focus, legend } = compile(`
    ((after x (effect x))
     (collect (after A) B))
  `, { collect, effect })
  const [first, second] = args(focus[1][1])

  assert.ok(graph[0])
  assert.equal(graph[1], focus)
  assert.equal(focus[1][0], focus[1])
  assert.equal(legend.get(focus[0]).capability, collect)
  assert.equal(legend.get(first[0]).capability, effect)
  assert.equal(legend.get(first[1][1][0]).name, 'A')
  assert.equal(legend.get(second).name, 'B')
})

test('keeps a pair-valued result in one argument frame', () => {
  const collect = () => {}
  const { focus, legend } = compile(`
    ((pair x (x x))
     (collect (pair A)))
  `, { collect })
  const values = args(focus[1][1])

  assert.equal(values.length, 1)
  assert.equal(legend.get(values[0][0]).name, 'A')
  assert.equal(values[0][0], values[0][1])
})
