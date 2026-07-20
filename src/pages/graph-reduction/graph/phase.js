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

export const project = (root, {
  count = 64,
  distinct = true,
  label,
  phase,
  shift = step
}) => {
  const phases = []
  let state = root

  for (let i = 0; i < count; i += 1) {
    const value = phase(state, i)
    const next = value && label ? label(value) : value

    if (next !== undefined && (!distinct || next !== phases.at(-1)))
      phases.push(next)

    state = shift(state)
  }

  return phases
}

export const period = phases => {
  for (let length = 1; length <= phases.length / 2; length += 1) {
    const periodic = phases.every(
      (phase, i) => i < length || phase === phases[i % length])

    if (periodic) return length
  }
}

export const orbit = (root, options) => {
  const phases = project(root, options)
  return { phases, period: period(phases) }
}
