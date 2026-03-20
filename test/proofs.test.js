import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { runProofs } from '../src/pages/graph-reduction/proofs/index.js'

describe('proofs runner', () => {
  test('all exact claims pass', () => {
    const proofs = runProofs()

    assert.equal(proofs.summary.exact.fail, 0)
    assert.equal(proofs.summary.exact.pass, proofs.summary.exact.total)

    for (const claim of proofs.exact)
      assert.equal(claim.status, 'pass', claim.title)
  })
})
