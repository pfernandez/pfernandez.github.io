import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { runProofs } from './index.js'

describe('proofs runner', () => {
  test('all exact claims pass', () => {
    const proofs = runProofs()
    const exactIds = proofs.exact.map(claim => claim.id)

    assert.equal(proofs.maxPairs, 7)
    assert.equal(proofs.summary.exact.fail, 0)
    assert.equal(proofs.summary.exact.pass, proofs.summary.exact.total)
    assert.deepEqual(
      exactIds,
      ['identity-collapse',
       'locality',
       'schedule',
       'normalization',
       'causal-wedge',
       'interval-proxy']
    )

    for (const claim of proofs.exact)
      assert.equal(claim.status, 'pass', claim.title)
  })
})
