import { steppers } from './observer-variants.mjs'
import { serialize } from '../serialize.mjs'

const maxPairs = Number(process.argv[2] ?? 4)
const steps = Number(process.argv[3] ?? 6)
const maxResults = Number(process.argv[4] ?? 40)
const classifySteps = Number(process.argv[5] ?? Math.max(steps * 4, 32))

const treeLeaves = [
  { text: 'x', graph: 'x', pairs: 0 },
  { text: '()', graph: [], pairs: 0 },
]

const cycleLeaves = [
  ...treeLeaves,
  { text: '@', graph: '@', pairs: 0 },
]

const generated = new Map()

const cloneTree = graph => {
  if (!Array.isArray(graph)) return graph
  if (graph.length === 0) return []
  return [cloneTree(graph[0]), cloneTree(graph[1])]
}

const generate = (pairs, leaves = treeLeaves) => {
  const key = `${leaves.map(leaf => leaf.text).join('')}:${pairs}`
  if (generated.has(key)) return generated.get(key)

  const seen = new Set()
  const terms = []

  for (let leftPairs = 0; leftPairs < pairs; leftPairs += 1) {
    const rightPairs = pairs - 1 - leftPairs

    for (const left of generate(leftPairs, leaves)) {
      for (const right of generate(rightPairs, leaves)) {
        const text = `(${left.text} ${right.text})`
        if (seen.has(text)) continue

        seen.add(text)
        terms.push({
          text,
          graph: [cloneTree(left.graph), cloneTree(right.graph)],
          pairs,
        })
      }
    }
  }

  generated.set(key, terms)
  return terms
}

for (const leaves of [treeLeaves, cycleLeaves]) {
  generated.set(`${leaves.map(leaf => leaf.text).join('')}:0`, leaves)
}

const clone = (graph, seen = new Map()) => {
  if (!Array.isArray(graph)) return graph
  if (graph.length === 0) return []
  if (seen.has(graph)) return seen.get(graph)

  const copy = []
  seen.set(graph, copy)
  copy[0] = clone(graph[0], seen)
  copy[1] = clone(graph[1], seen)
  return copy
}

const topologyOf = graph => {
  const visited = new Set()
  const active = new Set()
  let shared = false

  const visit = node => {
    if (!Array.isArray(node) || node.length === 0) return false
    if (active.has(node)) return true
    if (visited.has(node)) {
      shared = true
      return false
    }

    active.add(node)
    const cyclic = node.some(visit)
    active.delete(node)
    visited.add(node)
    return cyclic
  }

  if (visit(graph)) return 'cycle'
  if (shared) return 'shared DAG'
  return 'tree'
}

const run = (graph, stepper) => {
  let current = clone(graph)
  let currentSerialized = serialize(current)
  const trace = [currentSerialized]
  const seen = new Map([[currentSerialized, 0]])
  let carries = /\bx\b/.test(currentSerialized)

  for (let step = 0; step < classifySteps; step += 1) {
    let next

    try {
      next = stepper(current)
    } catch (error) {
      return {
        trace,
        status: 'error',
        error: error.message,
        changedThroughLimit: false,
        carries: false,
      }
    }

    const serialized = serialize(next)
    if (trace.length <= steps) trace.push(serialized)
    carries &&= /\bx\b/.test(serialized)

    if (serialized === currentSerialized) {
      return {
        trace,
        status: 'stable',
        stableAt: step,
        carries,
      }
    }

    if (seen.has(serialized)) {
      return {
        trace,
        status: 'cycle',
        cycleFrom: seen.get(serialized),
        cycleAt: step + 1,
        carries,
      }
    }

    seen.set(serialized, step + 1)
    current = next
    currentSerialized = serialized
  }

  return {
    trace,
    status: 'survivor',
    carries,
  }
}

const slotTexts = new Set()

for (let pairs = 1; pairs <= maxPairs; pairs += 1) {
  for (const term of generate(pairs)) {
    slotTexts.add(term.text)
  }
}

const compileSlots = (text, slots) => {
  const tokens = text.match(/\(\)|\(|\)|x|s\d+/g) || []
  let index = 0

  const read = () => {
    const token = tokens[index]
    index += 1

    if (token === 'x') return 'x'
    if (token === '()') return []
    if (/^s\d+$/.test(token)) return slots.get(token)

    if (token === '(') {
      const left = read()
      const right = read()
      index += 1
      return [left, right]
    }

    throw new Error(`unexpected token: ${token}`)
  }

  return read()
}

const compileBackedge = text => {
  const backedge = Symbol('backedge')
  const tokens = text.match(/\(\)|\(|\)|x|@/g) || []
  let index = 0

  const read = () => {
    const token = tokens[index]
    index += 1

    if (token === 'x') return 'x'
    if (token === '()') return []
    if (token === '@') return backedge

    if (token === '(') {
      const left = read()
      const right = read()
      index += 1
      return [left, right]
    }

    throw new Error(`unexpected token: ${token}`)
  }

  const ast = read()
  if (!Array.isArray(ast)) throw new Error('root backedge needs a pair root')

  const root = []

  const build = node => {
    if (node === backedge) return root
    if (!Array.isArray(node)) return node
    if (node.length === 0) return []
    return [build(node[0]), build(node[1])]
  }

  root[0] = build(ast[0])
  root[1] = build(ast[1])

  return root
}

const slotShapes = [
  {
    name: 'left slot',
    text: '(() x)',
    build: () => [[], 'x'],
  },
  {
    name: 'right slot',
    text: '(x ())',
    build: () => ['x', []],
  },
  {
    name: 'left slot delay',
    text: '(() (() x))',
    build: () => [[], [[], 'x']],
  },
  {
    name: 'right slot delay',
    text: '((x ()) ())',
    build: () => [['x', []], []],
  },
]

const buildSlotDag = (text, slotShape) => {
  const slots = new Map()

  slots.set('s0', slotShape.build())

  return compileSlots(text, slots)
}

const slotTerms = []
const cycleTerms = []

for (const text of slotTexts) {
  if (!text.includes('x')) continue

  const oneSlot = text.replaceAll('x', 's0')

  for (const slotShape of slotShapes) {
    slotTerms.push({
      text: `${oneSlot} where s0=${slotShape.text}`,
      shape: slotShape.name,
      graph: buildSlotDag(oneSlot, slotShape),
    })
  }
}

for (let pairs = 1; pairs <= maxPairs; pairs += 1) {
  for (const term of generate(pairs, cycleLeaves)) {
    const backedges = term.text.match(/@/g)?.length ?? 0
    if (backedges !== 1 || !term.text.includes('x')) continue

    const graph = compileBackedge(term.text)

    cycleTerms.push({
      text: `${term.text} where @=root`,
      shape: 'one back-edge',
      pairs: term.pairs,
      graph,
    })
  }
}

const candidates = []

for (let pairs = 1; pairs <= maxPairs; pairs += 1) {
  for (const term of generate(pairs)) {
    for (const [stepperName, stepper] of steppers) {
      const result = run(term.graph, stepper)

      candidates.push({
        term,
        stepperName,
        result,
      })
    }
  }
}

for (const term of slotTerms) {
  for (const [stepperName, stepper] of steppers) {
    const result = run(term.graph, stepper)

    candidates.push({
      term,
      stepperName,
      result,
    })
  }
}

for (const term of cycleTerms) {
  for (const [stepperName, stepper] of steppers) {
    const result = run(term.graph, stepper)

    candidates.push({
      term,
      stepperName,
      result,
    })
  }
}

const interesting = candidates.filter(candidate =>
  candidate.result.status !== 'stable' && candidate.result.carries
)

const longestFiniteCarriers = candidates
  .filter(candidate => candidate.result.status === 'stable' && candidate.result.carries)
  .sort((left, right) => right.result.stableAt - left.result.stableAt)
  .slice(0, Math.min(5, maxResults))

const counts = candidates.reduce((map, candidate) => {
  const shape = candidate.term.shape ?? 'tree'
  const topology = topologyOf(candidate.term.graph)
  const key = `${candidate.stepperName} / ${topology} / ${shape} / ${candidate.result.status}${candidate.result.carries ? ' carries' : ' drops'}`
  map.set(key, (map.get(key) ?? 0) + 1)
  return map
}, new Map())

const smallestCyclicCarriers = candidates
  .filter(candidate =>
    topologyOf(candidate.term.graph) === 'cycle' &&
    candidate.result.status !== 'stable' &&
    candidate.result.carries
  )
  .sort((left, right) =>
    (left.term.pairs ?? 0) - (right.term.pairs ?? 0) ||
    left.term.text.length - right.term.text.length
  )
  .slice(0, Math.min(5, maxResults))

console.log(`searched: <= ${maxPairs} pairs, display ${steps} steps, classify ${classifySteps} steps`)
console.log(`candidates: ${candidates.length}`)
console.log(`interesting: ${interesting.length}`)

for (const [key, count] of [...counts.entries()].sort()) {
  console.log(`${key}: ${count}`)
}

if (longestFiniteCarriers.length) {
  console.log('\nlongest finite carriers:')
  longestFiniteCarriers.forEach((candidate, index) => {
    console.log(
      `#${index + 1} stable at ${candidate.result.stableAt} ` +
      `${candidate.stepperName} ${candidate.term.text}`
    )
  })
}

if (smallestCyclicCarriers.length) {
  console.log('\nsmallest cyclic carriers:')
  smallestCyclicCarriers.forEach((candidate, index) => {
    console.log(`#${index + 1} ${candidate.stepperName} ${candidate.term.text}`)
  })
}

interesting.slice(0, maxResults).forEach((candidate, index) => {
  const result = candidate.result
  const status = result.status === 'cycle'
    ? `cycle ${result.cycleFrom}->${result.cycleAt}`
    : result.status

  console.log(`\n#${index + 1} ${candidate.stepperName} ${status} ${candidate.term.text}`)
  candidate.result.trace.forEach((line, step) => {
    console.log(`${String(step).padStart(2, '0')}: ${line}`)
  })
})

if (interesting.length > maxResults) {
  console.log(`\n... ${interesting.length - maxResults} more interesting matches omitted`)
}
