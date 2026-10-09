import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from '../../graph/parse.js'
import { apply } from './apply.js'
import { tie } from './tie.js'
import { next } from '../materialize/materialize.js'

const source = readFileSync(new URL('./counter.lisp', import.meta.url), 'utf8')

// Link-time wiring: clock the low bit and send its carry to the high bit.
// The finite joint orbit is constructed here; runtime only follows right edges.
const couple = source => {
  const linked = tie(undefined, parse(source))
  const frames = []
  const visit = state => {
    const [low, high] = state
    const known = frames.find(frame =>
      frame[0][0] === low && frame[0][1] === high)
    if (known) return known

    const frame = [Object.freeze(state)]
    frames.push(frame)
    const carry = low[0][1]
    const highNext = apply(carry, [high, next(high)])
    frame[1] = visit([next(low), highNext])
    return Object.freeze(frame)
  }

  return { ...linked, focus: visit(linked.root), frames }
}

// Projection and bounded sampling are outside the counter's transition rule.
const sample = ({ focus, identities }, ticks) => {
  const one = identities.get('one')
  const observations = []
  for (let tick = 0; tick < ticks; tick++) {
    const [low, high] = focus[0]
    observations.push([high, low]
      .map(bit => bit[0][0] === one ? '1' : '0').join(''))
    focus = next(focus)
  }
  return observations
}

test('clocks a second bit through the first bit\'s authored carry', () => {
  const counter = couple(source)

  assert.deepEqual(sample(counter, 8), [
    '00', '01', '10', '11', '00', '01', '10', '11'
  ])
  assert.equal(counter.frames.length, 4)
  assert.equal(next(next(next(next(counter.focus)))), counter.focus)
  assert.ok(counter.frames.every(frame =>
    Object.isFrozen(frame) && Object.isFrozen(frame[0])))
})

test('shares component states while retaining different low and high phases', () => {
  const { focus, frames, identities } = couple(source)
  const off = identities.get('off')
  const on = identities.get('on')
  const states = new Set(frames.flatMap(frame => frame[0]))

  assert.equal(states.size, 2)
  assert.ok(states.has(off))
  assert.ok(states.has(on))
  assert.equal(next(focus)[0][0], on)
  assert.equal(next(focus)[0][1], off)
  assert.equal(next(next(focus))[0][0], off)
  assert.equal(next(next(focus))[0][1], on)
  assert.equal(off[1], on)
  assert.equal(on[1], off)
  assert.ok(Object.isFrozen(off) && Object.isFrozen(on))
})

test('rewiring quiet to pulse clocks both bits on every step', () => {
  const counter = couple(source.replace('(zero quiet)', '(zero pulse)'))

  assert.deepEqual(sample(counter, 6), ['00', '11', '00', '11', '00', '11'])
  assert.equal(counter.frames.length, 2)
})

test('disconnecting carry leaves the high bit unchanged', () => {
  const counter = couple(source.replace('(one pulse)', '(one quiet)'))

  assert.deepEqual(sample(counter, 6), ['00', '01', '00', '01', '00', '01'])
  assert.equal(counter.frames.length, 2)
})
