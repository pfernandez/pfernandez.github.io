import { compile } from '../seed/compile.js'
import {
  advance,
  begin,
  pending,
  focus as select
} from '../seed/reduce.js'
import {
  materialize,
  pair,
  retain,
  sequence
} from './materialize.js'

const named = (legend, name) => [...legend]
  .find(([, entry]) => entry.name === name)?.[0]

const graphIdentities = history => {
  const identities = new Set()
  const collect = graph => {
    if (!Array.isArray(graph) || identities.has(graph)) return
    identities.add(graph)
    graph.forEach(collect)
  }
  collect(history)
  return identities
}

const same = (
  left,
  right,
  identities,
  seen = new Map(),
  reverse = new Map()
) => {
  if (left === right) return true
  if (!Array.isArray(left)
    || !Array.isArray(right)
    || identities.has(left)
    || identities.has(right)) return false
  if (seen.has(left) || reverse.has(right))
    return seen.get(left) === right && reverse.get(right) === left

  seen.set(left, right)
  reverse.set(right, left)
  return same(left[0], right[0], identities, seen, reverse)
    && same(left[1], right[1], identities, seen, reverse)
}

const reduce = (expression, origin, identities, legend) => {
  const states = []
  const observations = []
  let current = begin(expression, origin)

  while (true) {
    const repeat = states.findIndex(state =>
      same(current, state, identities))
    if (repeat >= 0) return { observations, repeat }

    states.push(current)
    const observation = select(current)
    observations.push(observation)
    if (legend.get(observation[0])?.capability)
      return { observations }
    if (!pending(current)) return { observations }
    current = advance(current)
  }
}

/** Compile contextual reduction into one static observer trajectory. */
export const link = (source, imports) => {
  const connected = compile(source, imports)
  const origin = named(connected.legend, 'Origin')
  if (!origin) throw new ReferenceError('Missing Origin')

  const reduction = reduce(
    connected.focus,
    origin,
    graphIdentities(connected.graph),
    connected.legend
  )

  const focus = materialize(sequence(
    ...reduction.observations.map(retain)
  ), reduction.repeat)

  return {
    focus,
    graph: pair(connected.graph, focus),
    legend: connected.legend
  }
}
