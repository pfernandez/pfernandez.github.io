import { step } from './lens.js'

export const nameOf = (legend, node) =>
  legend.find(entry => entry.node === node)?.symbol

export const application = (legend, node, args = [], seen = new Set()) => {
  const symbol = nameOf(legend, node)

  return symbol
    ? { symbol, args }
    : Array.isArray(node) && !seen.has(node)
      ? (seen.add(node), application(legend, node[0], [node[1], ...args], seen))
      : { symbol, args }
}

export const loopPhase = (
  legend,
  { loop = 'Loop', transition = 'Next', index = 1 } = {}
) => state => {
  const frame = application(legend, state[0])

  if (frame.symbol !== loop) return
  if (transition && nameOf(legend, frame.args[0]) !== transition) return

  return frame.args[index]
}

export const sample = (root, {
  count = 64,
  distinct = true,
  label,
  phase,
  shift = step
}) => {
  const samples = []
  let state = root

  for (let i = 0; i < count; i += 1) {
    const value = phase(state, i)
    const next = value && label ? label(value) : value
    const prior = samples.at(-1)?.phase

    if (next !== undefined && (!distinct || next !== prior))
      samples.push({ at: i, phase: next })

    state = shift(state)
  }

  return samples
}

export const project = (root, options) =>
  sample(root, options).map(({ phase }) => phase)

export const period = phases => {
  for (let length = 1; length < phases.length; length += 1) {
    const returned = phases[length] === phases[0]
    const periodic = returned && phases.every(
      (phase, i) => phase === phases[i % length])

    if (periodic) return length
  }
}

export const gaps = samples =>
  samples.slice(1).map(({ at }, i) => at - samples[i].at)

export const transitions = phases =>
  phases.slice(1).map((phase, i) => [phases[i], phase])

export const orbit = (root, options) => {
  const samples = sample(root, options)
  const phases = samples.map(({ phase }) => phase)

  return {
    gaps: gaps(samples),
    period: period(phases),
    phases,
    samples,
    transitions: transitions(phases)
  }
}
