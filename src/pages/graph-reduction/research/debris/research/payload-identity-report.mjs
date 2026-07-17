import { writeFileSync } from 'node:fs'
import { steppers } from './observer-variants.mjs'

const delayMax = Number(process.argv[2] ?? 6)
const steps = Number(process.argv[3] ?? 8)
const classifySteps = Number(process.argv[4] ?? Math.max(steps * 4, 32))
const outputPath = process.argv[5] ?? new URL('./payload-identity-report.md', import.meta.url)
const serializeLimit = 30_000

const clone = (graph, seen = new Map()) => {
  if (!Array.isArray(graph)) return graph
  if (seen.has(graph)) return seen.get(graph)

  const copy = []
  seen.set(graph, copy)

  if (graph.length === 0) return copy

  copy[0] = clone(graph[0], seen)
  copy[1] = clone(graph[1], seen)
  return copy
}

const serialize = graph => {
  let used = 0

  const print = (node, path = '$', seen = new Map()) => {
    if (used > serializeLimit) return '...'
    if (!Array.isArray(node)) {
      used += String(node).length
      return String(node)
    }
    if (seen.has(node)) return seen.get(node)

    seen.set(node, path)

    if (node.length === 0) {
      used += 2
      return '()'
    }

    const text = `(${print(node[0], `${path}[0]`, seen)} ${print(node[1], `${path}[1]`, seen)})`
    used += text.length
    return used > serializeLimit ? '...' : text
  }

  return print(graph)
}

const countArrays = graph => {
  const seen = new Set()

  const visit = node => {
    if (!Array.isArray(node) || seen.has(node)) return
    seen.add(node)
    if (node.length !== 0) {
      visit(node[0])
      visit(node[1])
    }
  }

  visit(graph)
  return seen.size
}

const countNonEmptyPairs = graph => {
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

const run = (graph, stepper) => {
  let current = clone(graph)
  let currentSerialized = serialize(current)
  const trace = [currentSerialized]
  const seen = new Map([[currentSerialized, 0]])
  const arrays = [countArrays(current)]
  const pairs = [countNonEmptyPairs(current)]
  const markers = [(currentSerialized.match(/\bx\b/g) ?? []).length]

  for (let step = 0; step < classifySteps; step += 1) {
    let next

    try {
      next = stepper(current)
    } catch (error) {
      return {
        status: 'error',
        detail: error.message,
        trace,
        arrays,
        pairs,
        markers,
      }
    }

    const serialized = serialize(next)
    if (trace.length <= steps) trace.push(serialized)

    arrays.push(countArrays(next))
    pairs.push(countNonEmptyPairs(next))
    markers.push((serialized.match(/\bx\b/g) ?? []).length)

    if (serialized === currentSerialized) {
      return {
        status: 'stable',
        detail: String(step),
        trace,
        arrays,
        pairs,
        markers,
      }
    }

    if (seen.has(serialized)) {
      return {
        status: 'periodic',
        detail: `${seen.get(serialized)}->${step + 1}`,
        trace,
        arrays,
        pairs,
        markers,
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
    arrays,
    pairs,
    markers,
  }
}

const trendOf = result => {
  const firstArrays = result.arrays[0]
  const lastArrays = result.arrays.at(-1)
  const firstPairs = result.pairs[0]
  const lastPairs = result.pairs.at(-1)
  const firstMarkers = result.markers[0]
  const lastMarkers = result.markers.at(-1)

  if (result.status === 'error') return 'error'
  if (lastMarkers > firstMarkers) return 'emits marker'
  if (lastPairs > firstPairs) return 'grows pairs'
  if (lastArrays > firstArrays) return 'grows arrays'
  if (lastArrays < firstArrays) return 'collapses'
  return 'bounded'
}

const context = () => {
  const I = []
  const II = [I, I]
  const freshEvent = [[], []]
  const recursive = []
  recursive[0] = recursive
  recursive[1] = recursive

  return {
    I,
    II,
    freshEvent,
    recursive,
  }
}

const payloads = [
  {
    name: 'atom x',
    family: 'atom marker',
    source: 'x',
    build: () => 'x',
  },
  {
    name: 'shared I',
    family: 'single empty reference',
    source: 'I where I=()',
    build: ctx => ctx.I,
  },
  {
    name: 'fresh empty',
    family: 'fresh empty',
    source: 'new ()',
    build: () => [],
  },
  {
    name: 'shared pair',
    family: 'shared pair over I',
    source: '(I I)',
    build: ctx => ctx.II,
  },
  {
    name: 'fresh event',
    family: 'fresh pair',
    source: '(() ())',
    build: () => [[], []],
  },
  {
    name: 'recursive pair',
    family: 'fully recursive payload',
    source: 'R where R=(R R)',
    build: ctx => ctx.recursive,
  },
]

const delay = (target, side, length) => {
  if (length === 0) return target
  return side === 'left' ? [[], delay(target, side, length - 1)] : [delay(target, side, length - 1), []]
}

const motifs = delayLength => [
  {
    name: 'right-growing delayed cycle',
    source: `payload (()^${delayLength} @)`,
    build: payload => {
      const graph = []
      graph[0] = payload
      graph[1] = delay(graph, 'left', delayLength)
      return graph
    },
  },
  {
    name: 'left-growing delayed cycle',
    source: `(()^${delayLength} @) payload`,
    build: payload => {
      const graph = []
      graph[0] = delay(graph, 'left', delayLength)
      graph[1] = payload
      return graph
    },
  },
  {
    name: 'right-empty mirror stream',
    source: `payload (@ ())^${delayLength}`,
    build: payload => {
      const graph = []
      graph[0] = payload
      graph[1] = delay(graph, 'right', delayLength)
      return graph
    },
  },
  {
    name: 'right-empty mirror Z',
    source: `(@ ())^${delayLength} payload`,
    build: payload => {
      const graph = []
      graph[0] = delay(graph, 'right', delayLength)
      graph[1] = payload
      return graph
    },
  },
  {
    name: 'finite payload left',
    source: 'payload ()',
    build: payload => [payload, []],
  },
  {
    name: 'finite payload right',
    source: '() payload',
    build: payload => [[], payload],
  },
  {
    name: 'duplicated payload',
    source: 'payload payload',
    build: payload => [payload, payload],
  },
]

const boundaryGraphs = [
  {
    name: 'single I',
    payload: 'none',
    family: 'single empty reference',
    motif: 'boundary',
    source: 'I where I=()',
    graph: [],
  },
  {
    name: 'fully recursive root',
    payload: 'none',
    family: 'fully recursive ref-only',
    motif: 'boundary',
    source: 'R where R=(R R)',
    graph: (() => {
      const graph = []
      graph[0] = graph
      graph[1] = graph
      return graph
    })(),
  },
]

const candidates = []

for (let length = 1; length <= delayMax; length += 1) {
  for (const motif of motifs(length)) {
    for (const payload of payloads) {
      const ctx = context()
      const payloadGraph = payload.build(ctx)

      candidates.push({
        name: `${motif.name} / ${payload.name} / ${length}`,
        payload: payload.name,
        family: payload.family,
        motif: motif.name,
        source: `${motif.source}; payload=${payload.source}`,
        graph: motif.build(payloadGraph),
      })
    }
  }
}

candidates.push(...boundaryGraphs)

const results = []

for (const candidate of candidates) {
  for (const [stepperName, stepper] of steppers) {
    const result = run(candidate.graph, stepper)

    results.push({
      ...candidate,
      stepperName,
      result,
      trend: trendOf(result),
      structuralSurvivor: result.status === 'survivor' && result.arrays.at(-1) > result.arrays[0],
      markedSurvivor: result.status === 'survivor' && result.markers.at(-1) > 0,
    })
  }
}

const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.map(escape).join(' | ')} |`),
].join('\n')

const topLineRows = [
  [
    'Marked recurrence',
    String(results.filter(row => row.markedSurvivor).length),
    '`x` still works as a dye marker, but it is not part of the pair-only ontology.',
  ],
  [
    'Pair-only structural recurrence',
    String(results.filter(row => row.family !== 'atom marker' && row.structuralSurvivor).length),
    'Pair-only payloads can make structure keep unfolding, but without a dye marker the payload is only topology.',
  ],
  [
    'Single I recurrence',
    String(results.filter(row => row.family === 'single empty reference' && row.structuralSurvivor).length),
    'A lone shared empty pair is usually absorbed; it does not carry distinguishable content by itself.',
  ],
  [
    'Fully recursive ref-only recurrence',
    String(results.filter(row => row.family === 'fully recursive ref-only' && row.structuralSurvivor).length),
    'Pure reference reuse can expand as vacuum structure, but carries no distinguishable payload.',
  ],
]

const outcomeRows = [...results.reduce((counts, row) => {
  increment(counts, `${row.stepperName}|${row.family}|${row.result.status}|${row.trend}`)
  return counts
}, new Map())]
  .sort()
  .map(([key, count]) => [...key.split('|'), String(count)])

const pairOnlySurvivorRows = results
  .filter(row => row.family !== 'atom marker' && row.structuralSurvivor)
  .sort((left, right) =>
    left.family.localeCompare(right.family) ||
    left.stepperName.localeCompare(right.stepperName) ||
    left.source.length - right.source.length
  )
  .slice(0, 40)
  .map(row => [
    row.stepperName,
    row.family,
    row.payload,
    row.motif,
    row.trend,
    row.source,
    row.result.trace.at(-1),
  ])

const markedSurvivorRows = results
  .filter(row => row.markedSurvivor)
  .sort((left, right) =>
    left.stepperName.localeCompare(right.stepperName) ||
    left.source.length - right.source.length
  )
  .slice(0, 16)
  .map(row => [
    row.stepperName,
    row.payload,
    row.motif,
    row.trend,
    row.source,
    row.result.trace.at(-1),
  ])

const boundaryRows = results
  .filter(row =>
    row.motif === 'boundary' ||
    (row.source.includes('^1') && ['atom x', 'shared I', 'shared pair', 'recursive pair'].includes(row.payload))
  )
  .map(row => [
    row.stepperName,
    row.family,
    row.payload,
    row.motif,
    row.result.status,
    row.trend,
    row.source,
  ])

const report = `# Payload Identity Report

Generated by \`node payload-identity-report.mjs ${delayMax} ${steps} ${classifySteps} ${outputPath}\`.

This report asks what happens when the marker \`x\` is removed. The same cyclic clocks are tested with payloads made only from pairs:

- shared \`I = ()\`
- fresh \`()\`
- shared \`(I I)\`
- fresh \`(() ())\`
- fully recursive \`R = (R R)\`

The important limitation is intentional: once atoms are removed, there is no external dye marker. Survival can only mean structural survival, shared identity, or continued unfolding.

## Top-Line Findings

${table(['Question', 'Count', 'Interpretation'], topLineRows)}

## Outcome Matrix

${table(['Stepper', 'Payload Family', 'Status', 'Trend', 'Count'], outcomeRows)}

## Pair-Only Survivor Examples

${pairOnlySurvivorRows.length
  ? table(['Stepper', 'Payload Family', 'Payload', 'Motif', 'Trend', 'Structure', `Trace at ${steps}`], pairOnlySurvivorRows)
  : 'No pair-only structural survivors found.'}

## Marked Baseline Examples

${markedSurvivorRows.length
  ? table(['Stepper', 'Payload', 'Motif', 'Trend', 'Structure', `Trace at ${steps}`], markedSurvivorRows)
  : 'No marked survivors found.'}

## Boundary Rows

${table(['Stepper', 'Payload Family', 'Payload', 'Motif', 'Status', 'Trend', 'Structure'], boundaryRows)}

## Discussion

### What \`x\` Was Doing

\`x\` was a dye marker. It let the reports distinguish information survival from mere structure growth. Removing it is conceptually right if the ontology has only pairs, but it removes the easy observational test. From this point on, "payload" cannot mean an atom being carried. It must mean a recognizable pair topology or a preserved reference.

### Shared \`I = ()\`

A single shared empty pair is almost vacuum. Under the current observers, \`()\` is unobservable. If it appears in a left slot for \`observe\`, it is consumed as a boundary. If it appears elsewhere, it can remain as inert structure. That means a universe made only of one empty reference is not computationally rich by itself.

The weak one-reference version remains viable: many larger structures may share the same \`I\` as their leaf. But the distinctions then come from the wrapper topology, not from \`I\` itself.

### Pair Payloads

\`(I I)\` and \`(() ())\` are finite pair payloads. They can survive for a while or participate in structural unfolding, but they also normalize as ordinary finite structures. They are not persistent content unless the surrounding topology keeps reintroducing them.

This suggests that doing away with atoms is possible, but only if "content" means a shape in the causal lattice rather than an indivisible value.

### Fully Recursive Pair Payload

\`R = (R R)\` is the strong single-reference boundary. It can create recursive/vacuum behavior, but it contains no event distinction. The reports should not count that as information unless the theory assigns meaning or weight to vacuum topology itself.

### Viability of One Reference

The strong version, where literally everything is one reference and the observer does not allocate new structure, still looks too poor: it is vacuum, collapse, or error.

The interesting version is different: one reference may be a seed or law, and observer time may unfold new structure from it. That is viable, but then the universe is not "only one object" operationally. It is one compact generator plus an observer that produces history.

### Next Legal-Topology Implication

If atoms are removed, legal topology probably has to distinguish:

- vacuum reference: \`I = ()\`
- finite event shape: fresh pair topology
- shared event: reused pair topology
- recurrence law: delayed cyclic topology

That keeps the ontology pair-only while preserving the semantic difference between finite events and generators.
`

writeFileSync(outputPath, report)
console.log(`wrote ${outputPath}`)
console.log(`candidates: ${candidates.length}`)
console.log(`results: ${results.length}`)
