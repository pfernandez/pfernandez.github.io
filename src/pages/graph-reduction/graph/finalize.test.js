import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose } from './compose.js'
import { connect } from './connect.js'
import { decompose } from './decompose.js'
import { finalize } from './finalize.js'
import { parse } from './parse.js'

test('closes construction frontiers and freezes the composed graph', () => {
  const composed = compose(connect(decompose(parse('((I x x) (I a))'))))
  const atom = [...composed.legend]
    .find(([, entry]) => entry.name === 'a')[0]

  assert.equal(atom.length, 1)

  const finalized = finalize(composed)

  assert.equal(finalized, composed)
  assert.equal(atom[0], atom)
  assert.equal(atom[1], atom)
  assert.equal(Object.isFrozen(atom), true)
  assert.equal(Object.isFrozen(finalized.graph), true)
})
