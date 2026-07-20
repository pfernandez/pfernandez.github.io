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
    assert.deepEqual(result.gaps.slice(0, 6), [4, 4, 4, 4, 4, 4])
    assert.deepEqual(result.transitions.slice(0, 3), [
      ['K0', 'K1'],
      ['K1', 'K2'],
      ['K2', 'K3']
    ])
  })

  test('projects the counter as a four-phase orbit', () => {
    const source = readFileSync(
      new URL('../link-counter.lisp', import.meta.url),
      'utf8')
    const { graph, legend } = linked(source)
    const result = orbit(graph, {
      count: 80,
      label: nameOf.bind(null, legend),
      phase: loopPhase(legend)
    })

    assert.deepEqual(result.phases.slice(0, 5), [
      'B00',
      'B01',
      'B10',
      'B11',
      'B00'
    ])
    assert.equal(result.period, 4)
    assert.deepEqual(result.gaps.slice(0, 4), [6, 6, 6, 6])
  })
})
