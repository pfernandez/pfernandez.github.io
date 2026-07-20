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

  test('projects coupled local clocks as one orbit', () => {
    const source = readFileSync(
      new URL('../link-coupled.lisp', import.meta.url),
      'utf8')
    const { graph, legend } = linked(source)
    const result = orbit(graph, {
      count: 100,
      label: nameOf.bind(null, legend),
      phase: loopPhase(legend)
    })

    assert.deepEqual(result.phases.slice(0, 5), [
      'P00',
      'P10',
      'P01',
      'P11',
      'P00'
    ])
    assert.equal(result.period, 4)
    assert.deepEqual(result.transitions.slice(0, 4), [
      ['P00', 'P10'],
      ['P10', 'P01'],
      ['P01', 'P11'],
      ['P11', 'P00']
    ])
  })

  test('projects a three-gear odometer orbit', () => {
    const source = readFileSync(
      new URL('../link-odometer.lisp', import.meta.url),
      'utf8')
    const { graph, legend } = linked(source)
    const result = orbit(graph, {
      count: 240,
      label: nameOf.bind(null, legend),
      phase: loopPhase(legend)
    })

    assert.deepEqual(result.phases.slice(0, 9), [
      'P000',
      'P100',
      'P010',
      'P110',
      'P001',
      'P101',
      'P011',
      'P111',
      'P000'
    ])
    assert.equal(result.period, 8)
  })
})
