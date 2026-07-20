import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { link } from './link.js'
import { loopPhase, nameOf, orbit } from './phase.js'

const linked = source => {
  const result = link(source)
  if (result.error) throw result.error
  return result
}

describe('phase orbits', () => {
  test('projects a live kernel stream as a recurring phase orbit', () => {
    const source = readFileSync(
      new URL('../link-kernel.lisp', import.meta.url),
      'utf8')
    const { graph, legend } = linked(source)
    const result = orbit(graph, {
      count: 80,
      label: nameOf.bind(null, legend),
      phase: loopPhase(legend)
    })

    assert.deepEqual(result.phases.slice(0, 7), [
      'K0',
      'K1',
      'K2',
      'K3',
      'K4',
      'K5',
      'K0'
    ])
    assert.equal(result.period, 6)
  })
})
