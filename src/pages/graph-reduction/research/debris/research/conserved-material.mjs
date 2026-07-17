import { pathToFileURL } from 'url'
import { serialize } from '../serialize.mjs'

export const empty = []

const isPair = node =>
  Array.isArray(node) && node.length !== 0

const isEmpty = node =>
  Array.isArray(node) && node.length === 0

// Observation is selection only: no new pair is returned after the graph exists.
export const observe = focus => {
  if (!isPair(focus)) return focus

  const [first, rest] = focus

  if (first === focus || isEmpty(first)) return rest

  const nextFirst = observe(first)
  if (nextFirst !== first) return nextFirst

  const nextRest = observe(rest)
  if (nextRest !== rest) return nextRest

  return focus
}

export const collectPairs = root => {
  const pairs = new Set()

  const visit = node => {
    if (!Array.isArray(node) || pairs.has(node)) return

    pairs.add(node)
    node.forEach(visit)
  }

  visit(root)
  return pairs
}

export const isConserved = (initialPairs, root) => {
  for (const pair of collectPairs(root)) {
    if (!initialPairs.has(pair)) return false
  }

  return true
}

export const orbit = (root, limit = 16) => {
  const initialPairs = collectPairs(root)
  const seen = new Map()
  const states = []
  let focus = root

  for (let step = 0; step <= limit; step++) {
    if (!isConserved(initialPairs, focus)) {
      return {
        states,
        conserved: false,
        cycleStart: undefined,
        cycleLength: undefined,
      }
    }

    if (seen.has(focus)) {
      return {
        states,
        conserved: true,
        cycleStart: seen.get(focus),
        cycleLength: step - seen.get(focus),
      }
    }

    seen.set(focus, step)
    states.push(focus)
    focus = observe(focus)
  }

  return {
    states,
    conserved: true,
    cycleStart: undefined,
    cycleLength: undefined,
  }
}

// I is the empty-left gate: (() x) -> x.
export const I = x => [empty, x]

// K selects the consequence already latent in the left branch and drops y.
export const K = (x, y) => [[empty, x], y]

// S stores the normal form as shared initial material: S x y z -> ((x z) (y z)).
export const S = (x, y, z) => {
  const xz = [x, z]
  const yz = [y, z]

  return [empty, [xz, yz]]
}

// Z is the smallest x-visible periodic carrier found by the bounded search.
export const Z = x => {
  const state = []
  const delay = []
  const gate = []

  state[0] = x
  state[1] = delay

  delay[0] = empty
  delay[1] = gate

  gate[0] = empty
  gate[1] = state

  return state
}

const printOrbit = (name, root) => {
  const result = orbit(root, 8)

  console.log(`\n${name}`)
  result.states.forEach((state, index) => {
    console.log(`${index}: ${serialize(state)}`)
  })

  if (result.cycleLength !== undefined) {
    console.log(`cycle: start=${result.cycleStart}, length=${result.cycleLength}`)
  }

  console.log(`conserved: ${result.conserved}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printOrbit('I', I('x'))
  printOrbit('K', K('x', 'y'))
  printOrbit('S', S('x', 'y', 'z'))
  printOrbit('Z', Z('x'))
}
