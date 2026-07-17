import { writeFileSync } from 'node:fs'
import { steppers } from './observer-variants.mjs'

const maxNodes = Number(process.argv[2] ?? 3)
const steps = Number(process.argv[3] ?? 8)
const classifySteps = Number(process.argv[4] ?? Math.max(steps * 4, 32))
const outputPath = process.argv[5] ?? new URL('./causal-lattice-report.md', import.meta.url)
const serializeLimit = 20_000

const serialize = graph => {
  let used = 0

  const print = (node, path = '$', seen = new Map()) => {
    if (used > serializeLimit) return '...'
    if (!Array.isArray(node)) {
      used += String(node).length
      return String(node)
    }
    if (node.length === 0) {
      used += 2
      return '()'
    }
    if (seen.has(node)) return seen.get(node)

    seen.set(node, path)

    const left = print(node[0], `${path}[0]`, seen)
    const right = print(node[1], `${path}[1]`, seen)
    const text = `(${left} ${right})`
    used += text.length
    return used > serializeLimit ? '...' : text
  }

  return print(graph)
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

const countReachablePairs = graph => {
  const seen = new Set()

  const visit = node => {
    if (!Array.isArray(node) || node.length === 0 || seen.has(node)) return
    seen.add(node)
    visit(node[0])
    visit(node[1])
  }

  visit(graph)
  return seen.size
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
    const cyclic = visit(node[0]) || visit(node[1])
    active.delete(node)
    visited.add(node)
    return cyclic
  }

  if (visit(graph)) return 'cycle'
  if (shared) return 'shared DAG'
  return 'tree'
}

const cycleKindOf = graph => {
  const nodes = []
  const seen = new Set()

  const collect = node => {
    if (!Array.isArray(node) || node.length === 0 || seen.has(node)) return
    seen.add(node)
    nodes.push(node)
    collect(node[0])
    collect(node[1])
  }

  collect(graph)

  const selfLoops = nodes.filter(node => node[0] === node || node[1] === node).length
  if (selfLoops === 0 && topologyOf(graph) !== 'cycle') return 'none'
  if (selfLoops === nodes.length && nodes.length === 1) return 'single self-cycle'
  if (selfLoops > 0) return 'self-cycle with context'
  return 'mutual or ancestor cycle'
}

const tokenCount = (text, token) => text.match(new RegExp(`\\b${token}\\b`, 'g'))?.length ?? 0

const run = (graph, stepper) => {
  let current = clone(graph)
  let currentSerialized = serialize(current)
  const trace = [currentSerialized]
  const seen = new Map([[currentSerialized, 0]])
  const pairs = [countReachablePairs(current)]
  const xCounts = [tokenCount(currentSerialized, 'x')]
  let carries = xCounts[0] > 0

  for (let step = 0; step < classifySteps; step += 1) {
    let next

    try {
      next = stepper(current)
    } catch (error) {
      return {
        status: 'error',
        detail: error.message,
        trace,
        carries: false,
        pairs,
        xCounts,
      }
    }

    const serialized = serialize(next)
    if (trace.length <= steps) trace.push(serialized)

    const xCount = tokenCount(serialized, 'x')
    pairs.push(countReachablePairs(next))
    xCounts.push(xCount)
    carries &&= xCount > 0

    if (serialized === currentSerialized) {
      return {
        status: 'stable',
        detail: String(step),
        trace,
        carries,
        pairs,
        xCounts,
      }
    }

    if (seen.has(serialized)) {
      return {
        status: 'periodic',
        detail: `${seen.get(serialized)}->${step + 1}`,
        trace,
        carries,
        pairs,
        xCounts,
      }
    }

    seen.set(serialized, step + 1)
    current = next
    currentSerialized = serialized
  }

  return {
    status: 'survivor',
    detail: String(classifySteps),
    trace,
    carries,
    pairs,
    xCounts,
  }
}

const trendOf = result => {
  const firstPairs = result.pairs[0]
  const lastPairs = result.pairs.at(-1)
  const firstX = result.xCounts[0]
  const lastX = result.xCounts.at(-1)

  if (result.status === 'error') return 'error'
  if (lastPairs > firstPairs && lastX > firstX) return 'grows structure and x'
  if (lastPairs > firstPairs) return 'grows structure'
  if (lastX > firstX) return 'emits x'
  if (lastPairs < firstPairs) return 'collapses'
  return 'bounded'
}

const childChoices = nodeCount => [
  { label: 'x', value: 'x' },
  { label: '()', value: [] },
  ...Array.from({ length: nodeCount }, (_, index) => ({
    label: index === 0 ? '@' : `@${index}`,
    ref: index,
  })),
]

const buildGraph = slots => {
  const nodeCount = slots.length / 2
  const nodes = Array.from({ length: nodeCount }, () => [])

  const child = slot => {
    if ('ref' in slot) return nodes[slot.ref]
    if (Array.isArray(slot.value)) return []
    return slot.value
  }

  for (let index = 0; index < nodeCount; index += 1) {
    nodes[index][0] = child(slots[index * 2])
    nodes[index][1] = child(slots[index * 2 + 1])
  }

  return nodes[0]
}

const formatGraph = slots => {
  const print = slot => slot.label
  const pairs = []

  for (let index = 0; index < slots.length / 2; index += 1) {
    pairs.push(`@${index}=(${print(slots[index * 2])} ${print(slots[index * 2 + 1])})`)
  }

  return pairs.join('; ').replace('@0=', '')
}

const enumerateGraphs = nodeCount => {
  const choices = childChoices(nodeCount)
  const slots = []
  const graphs = []
  const seen = new Set()

  const visit = depth => {
    if (depth === nodeCount * 2) {
      const graph = buildGraph(slots)
      const signature = serialize(graph)
      const reachable = countReachablePairs(graph)

      if (reachable === nodeCount && !seen.has(signature)) {
        seen.add(signature)
        graphs.push({
          source: formatGraph(slots),
          graph,
          nodeCount,
          topology: topologyOf(graph),
          cycleKind: cycleKindOf(graph),
        })
      }

      return
    }

    for (const choice of choices) {
      slots.push(choice)
      visit(depth + 1)
      slots.pop()
    }
  }

  visit(0)
  return graphs
}

const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)

const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
].join('\n')

const allGraphs = []

for (let nodeCount = 1; nodeCount <= maxNodes; nodeCount += 1) {
  allGraphs.push(...enumerateGraphs(nodeCount))
}

const results = []

for (const candidate of allGraphs) {
  for (const [stepperName, stepper] of steppers) {
    const result = run(candidate.graph, stepper)
    results.push({
      ...candidate,
      stepperName,
      result,
      trend: trendOf(result),
    })
  }
}

const countRows = [...results.reduce((counts, row) => {
  increment(counts, `${row.stepperName}|${row.topology}|${row.result.status}|${row.result.carries ? 'yes' : 'no'}`)
  return counts
}, new Map())]
  .sort()
  .map(([key, count]) => [...key.split('|'), String(count)])

const productiveRows = [...results.reduce((counts, row) => {
  if (row.result.status === 'survivor' && row.result.carries) {
    increment(counts, `${row.stepperName}|${row.topology}|${row.cycleKind}|${row.trend}`)
  }

  return counts
}, new Map())]
  .sort()
  .map(([key, count]) => [...key.split('|'), String(count)])

const examples = results
  .filter(row => row.result.status === 'survivor' && row.result.carries)
  .sort((left, right) =>
    left.nodeCount - right.nodeCount ||
    left.stepperName.localeCompare(right.stepperName) ||
    left.source.length - right.source.length
  )
  .slice(0, 20)
  .map(row => [
    row.stepperName,
    row.topology,
    row.cycleKind,
    row.source.replaceAll('|', '\\|'),
    row.trend,
    row.result.trace.at(-1).replaceAll('|', '\\|'),
  ])

const boundaryExamples = [
  ['fully recursive', '(@ @)'],
  ['raw left cycle', '(@ x)'],
  ['raw right cycle', '(x @)'],
  ['bare left-empty delay', '(() @)'],
  ['bare right-empty delay', '(@ ())'],
  ['right-growing stream', '(x @1); @1=(() @)'],
  ['left-growing Z', '(@1 x); @1=(() @)'],
  ['right-empty stream mirror', '(x @1); @1=(@ ())'],
  ['right-empty Z mirror', '(@1 x); @1=(@ ())'],
]

const findBySource = source => results.filter(row => row.source === source)

const boundaryRows = boundaryExamples.flatMap(([label, source]) =>
  findBySource(source).map(row => [
    label,
    source.replaceAll('|', '\\|'),
    row.stepperName,
    row.result.status,
    row.result.carries ? 'yes' : 'no',
    row.trend,
  ])
)

const report = `# Causal Lattice Search Report

Generated by \`node causal-lattice-report.mjs ${maxNodes} ${steps} ${classifySteps} ${outputPath}\`.

## Scope

This is a bounded exhaustive search over all reachable finite pair graphs up to ${maxNodes} pair node(s). Each slot may contain:

- \`x\`
- \`()\`
- a reference to any pair node in the graph, including itself

That covers fresh trees, shared DAGs, root back-edges, non-root ancestor cycles, mutual cycles, and fully recursive structures such as \`(@ @)\`. The bound is finite; larger node counts can be searched with the same script.

## Steppers

${table(['Stepper', 'Meaning'], [
  ['observe', 'left-empty depth-first observer'],
  ['right-empty step', 'right-empty depth-first dual experiment'],
  ['either-empty step', 'left-or-right empty observer'],
  ['local-only step', 'pair-local rewrite with no recursive descent'],
  ['breadth-first step', 'one simultaneous layer of recursive observation'],
  ['mutating either step', 'state-carrying observer that edits pairs in place'],
])}

## Overall Counts

${table(['Stepper', 'Topology', 'Status', 'Carries x', 'Count'], countRows)}

## Productive Survivors

These are structures that still changed after ${classifySteps} step(s) while retaining \`x\`.

${productiveRows.length
  ? table(['Stepper', 'Topology', 'Cycle kind', 'Trend', 'Count'], productiveRows)
  : 'No productive survivors found.'}

## Smallest Productive Examples

${examples.length
  ? table(['Stepper', 'Topology', 'Cycle kind', 'Structure', 'Trend', `Trace at ${steps}`], examples)
  : 'No productive examples found.'}

## Boundary Structures

${table(['Name', 'Structure', 'Stepper', 'Status', 'Carries x', 'Trend'], boundaryRows)}

## Discussion

### Trees, DAGs, and Dyck-Like Paths

Fresh trees are the crossing-free case: they correspond most closely to Dyck/Catalan paths. They can encode finite causal histories, but in this observer family they behave like fuses. They may carry \`x\` for several observer ticks, but without a back-edge there is no source of new history. Shared DAGs add crossing or reuse: two paths may point to the same event. That is already a departure from pure Dyck paths, but it is still acyclic. In these bounded runs, sharing changes timing and representation, not the basic finite-fuse character.

For probability and causal theory, this suggests a clean split: acyclic structures describe finite possibility spaces or finite path sums. They can be weighted, counted, and compared like lattice paths. Crossings are legal if shared events are legal; disallowing them recovers a Catalan/Dyck-like subspace.

### Cycles

Cycles are the first structures that can represent persistent recurrence. But a raw cycle is not automatically a clock. Some raw cycles collapse, and some over-recurse depending on the stepper. The productive cases are delayed cycles: the back-edge is hidden behind an observable empty-pair boundary, and an external payload rides beside that delay.

That makes cycles semantically loaded. If cycles are illegal, recurrence must be represented outside the structure by a state-carrying observer or by an infinite unfolding. If cycles are legal, they look like compact descriptions of infinite path sums: a finite motif standing for an unbounded causal history. In probability language, a cycle is not an ordinary finite event; it is more like a recursive generator, recurrence class, or fixed-point equation.

### Observe vs State-Carrying Observers

\`observe\`, \`either-empty step\`, and \`breadth-first step\` create new wrapper structure when a child changes. They are pure steppers: time appears as a new structure produced from an old one. \`mutating either step\` carries state in the graph itself by editing the current pair. That makes identity meaningful and tends to collapse the productive cyclic examples into bounded states.

So there are at least two defensible semantics:

- Pure observer semantics: history is produced as a sequence of immutable structures.
- State-carrying observer semantics: history is accumulated by changing an existing structure.

The first is closer to a causal path expansion. The second is closer to a machine state update.

### Causality

If causality means every event has only earlier causes, then cycles are illegal and only trees/DAGs remain. If causality allows fixed-point laws or compact recurrence, then cycles are legal but must be interpreted carefully: not as ordinary past events, but as generators of possible futures. The delayed-cycle motifs are especially interesting because the observer never consumes the whole cycle at once. It sees one boundary crossing per tick.

This is the closest analogue here to a causal lattice with paths: each observation chooses or exposes the next local consequence. With crossings disallowed, the space is Dyck-like. With crossings allowed, shared DAGs model converging histories. With cycles allowed, the lattice contains compact infinite histories.

## What Remains

This report is exhaustive only up to the configured finite node bound. The next systematic expansions are:

- increase \`maxNodes\`
- separate one-cycle, two-cycle, and mutual-cycle families
- search payload motion through multiple delayed slots
- compare pure and mutating steppers with explicit identity-sensitive metrics
- add weights/probabilities to path families once the legal topology is chosen
`

writeFileSync(outputPath, report)
console.log(`wrote ${outputPath}`)
console.log(`graphs: ${allGraphs.length}`)
console.log(`results: ${results.length}`)
