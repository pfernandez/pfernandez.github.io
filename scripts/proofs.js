#!/usr/bin/env node

import { runProofs } from '../src/pages/graph-reduction/proofs/index.js'

const proofs = runProofs()
const lines = [
  'Graph Reduction Proofs',
  '',
  `Exact: ${proofs.summary.exact.pass}/${proofs.summary.exact.total} passing`
]

if (proofs.summary.exact.fail) {
  lines.push(`Exact failures: ${proofs.summary.exact.fail}`)
}

lines.push(`Pending: ${proofs.summary.pending.pending}/${proofs.summary.pending.total}`)
lines.push('')

for (const claim of proofs.exact) {
  lines.push(`[${claim.status.toUpperCase()}] ${claim.title}`)
  lines.push(`  ${claim.note}`)
}

if (proofs.pending.length) {
  lines.push('')
  for (const claim of proofs.pending) {
    lines.push(`[PENDING] ${claim.title}`)
    lines.push(`  ${claim.note}`)
  }
}

process.stdout.write(`${lines.join('\n')}\n`)

if (proofs.summary.exact.fail) {
  process.exitCode = 1
}
