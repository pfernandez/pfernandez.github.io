import { writeFileSync } from 'node:fs'
import { steppers } from './observer-variants.mjs'

const freshMaxPairs = Number(process.argv[2] ?? 6)
const dagMaxNodes = Number(process.argv[3] ?? 4)
const exhaustiveMaxNodes = Number(process.argv[4] ?? 3)
const delayMax = Number(process.argv[5] ?? 6)
const steps = Number(process.argv[6] ?? 8)
const classifySteps = Number(process.argv[7] ?? Math.max(steps * 4, 32))
const outputPath = process.argv[8] ?? new URL('./legal-topology-report.md', import.meta.url)
const serializeLimit = 30_000

const pair = (left, right) => [left, right]

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

    const text = `(${print(node[0], `${path}[0]`, seen)} ${print(node[1], `${path}[1]`, seen)})`
    used += text.length
    return used > serializeLimit ? '...' : text
  }

  return print(graph)
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

  if (topologyOf(graph) !== 'cycle') return 'none'

  const selfLoops = nodes.filter(node => node[0] === node || node[1] === node).length
  if (nodes.length === 1 && selfLoops === 1) return 'single-node cycle'
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
  let mutates = false
  let allocates = false

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
        mutates,
        allocates,
      }
    }

    const serialized = serialize(next)
    if (trace.length <= steps) trace.push(serialized)

    const changed = serialized !== currentSerialized
    mutates ||= changed && next === current
    allocates ||= changed && next !== current

    const xCount = tokenCount(serialized, 'x')
    pairs.push(countReachablePairs(next))
    xCounts.push(xCount)
    carries &&= xCount > 0

    if (!changed) {
      return {
        status: 'stable',
        detail: String(step),
        trace,
        carries,
        pairs,
        xCounts,
        mutates,
        allocates,
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
        mutates,
        allocates,
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
    mutates,
    allocates,
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

const stateModeOf = result => {
  if (result.mutates && result.allocates) return 'mixed'
  if (result.mutates) return 'mutates'
  if (result.allocates) return 'allocates'
  return 'unchanged'
}

const freshMemo = new Map([[0, [
  { source: 'x', graph: 'x' },
  { source: '()', graph: [] },
]]])

const freshTrees = pairs => {
  if (freshMemo.has(pairs)) return freshMemo.get(pairs)

  const terms = []

  for (let leftPairs = 0; leftPairs < pairs; leftPairs += 1) {
    const rightPairs = pairs - 1 - leftPairs

    for (const left of freshTrees(leftPairs)) {
      for (const right of freshTrees(rightPairs)) {
        terms.push({
          source: `(${left.source} ${right.source})`,
          graph: pair(clone(left.graph), clone(right.graph)),
        })
      }
    }
  }

  freshMemo.set(pairs, terms)
  return terms
}

const childChoices = (nodeCount, acyclic, refOnly = false) => {
  const choices = refOnly ? [] : [
    { label: 'x', value: 'x' },
    { label: '()', value: [] },
  ]

  const start = acyclic ? 1 : 0

  for (let index = start; index < nodeCount; index += 1) {
    choices.push({ label: index === 0 ? '@' : `@${index}`, ref: index })
  }

  return choices
}

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

const formatSlots = slots => {
  const pairs = []

  for (let index = 0; index < slots.length / 2; index += 1) {
    pairs.push(`@${index}=(${slots[index * 2].label} ${slots[index * 2 + 1].label})`)
  }

  return pairs.join('; ').replace('@0=', '')
}

const enumerateSlotGraphs = ({ nodeCount, acyclic = false, refOnly = false }) => {
  const slots = []
  const graphs = []
  const seen = new Set()

  const choicesForDepth = depth => {
    if (!acyclic) return childChoices(nodeCount, false, refOnly)

    const currentNode = Math.floor(depth / 2)
    const choices = refOnly ? [] : [
      { label: 'x', value: 'x' },
      { label: '()', value: [] },
    ]

    for (let index = currentNode + 1; index < nodeCount; index += 1) {
      choices.push({ label: `@${index}`, ref: index })
    }

    return choices
  }

  const visit = depth => {
    if (depth === nodeCount * 2) {
      const graph = buildGraph(slots)
      const source = formatSlots(slots)
      const signature = serialize(graph)

      if (countReachablePairs(graph) === nodeCount && !seen.has(signature)) {
        seen.add(signature)
        graphs.push({ source, graph })
      }

      return
    }

    for (const choice of choicesForDepth(depth)) {
      slots.push(choice)
      visit(depth + 1)
      slots.pop()
    }
  }

  visit(0)
  return graphs
}

const leftDelay = target => [[], target]
const rightDelay = target => [target, []]

const delay = (target, side, length) => {
  if (length === 0) return target
  return side === 'left' ? leftDelay(delay(target, side, length - 1)) : rightDelay(delay(target, side, length - 1))
}

const delayedCycleMotifs = maxLength => {
  const motifs = []

  for (const side of ['left', 'right']) {
    for (const payload of ['left', 'right']) {
      for (let length = 1; length <= maxLength; length += 1) {
        const graph = []
        const delayed = delay(graph, side, length)

        if (payload === 'left') {
          graph[0] = 'x'
          graph[1] = delayed
        } else {
          graph[0] = delayed
          graph[1] = 'x'
        }

        motifs.push({
          source: `${payload}-payload ${side}-delay length ${length}`,
          graph,
        })
      }
    }
  }

  return motifs
}

const mutualCycleMotifs = maxLength => {
  const motifs = []

  for (const side of ['left', 'right']) {
    for (const payload of ['left', 'right']) {
      for (let length = 1; length <= maxLength; length += 1) {
        const root = []
        const loop = []
        const delayedLoop = delay(loop, side, length)
        const delayedRoot = delay(root, side, length)

        if (payload === 'left') {
          root[0] = 'x'
          root[1] = delayedLoop
        } else {
          root[0] = delayedLoop
          root[1] = 'x'
        }

        loop[0] = delayedRoot
        loop[1] = []

        motifs.push({
          source: `mutual ${payload}-payload ${side}-delay length ${length}`,
          graph: root,
        })
      }
    }
  }

  return motifs
}

const families = []

for (let pairs = 1; pairs <= freshMaxPairs; pairs += 1) {
  families.push({
    name: `fresh trees ${pairs}`,
    description: `all fresh trees with ${pairs} pair node(s)`,
    candidates: freshTrees(pairs).map(term => ({ ...term, family: 'fresh trees' })),
  })
}

for (let nodeCount = 1; nodeCount <= dagMaxNodes; nodeCount += 1) {
  families.push({
    name: `shared DAGs ${nodeCount}`,
    description: `all acyclic reference graphs with ${nodeCount} reachable pair node(s)`,
    candidates: enumerateSlotGraphs({ nodeCount, acyclic: true }).map(term => ({ ...term, family: 'shared DAGs' })),
  })
}

for (let nodeCount = 1; nodeCount <= exhaustiveMaxNodes; nodeCount += 1) {
  families.push({
    name: `all graphs ${nodeCount}`,
    description: `all reachable graphs with ${nodeCount} pair node(s)`,
    candidates: enumerateSlotGraphs({ nodeCount }).map(term => ({ ...term, family: 'all finite graphs' })),
  })
}

for (let nodeCount = 1; nodeCount <= exhaustiveMaxNodes; nodeCount += 1) {
  families.push({
    name: `ref-only ${nodeCount}`,
    description: `all reachable ref-only graphs with ${nodeCount} pair node(s)`,
    candidates: enumerateSlotGraphs({ nodeCount, refOnly: true }).map(term => ({ ...term, family: 'fully recursive ref-only' })),
  })
}

families.push({
  name: 'delayed cycles',
  description: `delayed self-cycles through length ${delayMax}`,
  candidates: delayedCycleMotifs(delayMax).map(term => ({ ...term, family: 'delayed cycles' })),
})

families.push({
  name: 'mutual delayed cycles',
  description: `mutual delayed cycles through length ${delayMax}`,
  candidates: mutualCycleMotifs(delayMax).map(term => ({ ...term, family: 'mutual delayed cycles' })),
})

const results = []

for (const family of families) {
  for (const candidate of family.candidates) {
    for (const [stepperName, stepper] of steppers) {
      const result = run(candidate.graph, stepper)

      results.push({
        ...candidate,
        family: candidate.family,
        familyName: family.name,
        stepperName,
        result,
        topology: topologyOf(candidate.graph),
        cycleKind: cycleKindOf(candidate.graph),
        trend: trendOf(result),
        stateMode: stateModeOf(result),
      })
    }
  }
}

const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.map(escape).join(' | ')} |`),
].join('\n')

const familyRows = families.map(family => [
  family.name,
  family.description,
  String(family.candidates.length),
])

const outcomeRows = [...results.reduce((counts, row) => {
  increment(counts, `${row.stepperName}|${row.family}|${row.topology}|${row.result.status}|${row.result.carries ? 'yes' : 'no'}|${row.trend}|${row.stateMode}`)
  return counts
}, new Map())]
  .sort()
  .map(([key, count]) => [...key.split('|'), String(count)])

const productiveRows = [...results.reduce((counts, row) => {
  if (row.result.status === 'survivor' && row.result.carries) {
    increment(counts, `${row.stepperName}|${row.family}|${row.topology}|${row.cycleKind}|${row.trend}`)
  }
  return counts
}, new Map())]
  .sort()
  .map(([key, count]) => [...key.split('|'), String(count)])

const exampleRows = results
  .filter(row => row.result.status === 'survivor' && row.result.carries)
  .sort((left, right) =>
    countReachablePairs(left.graph) - countReachablePairs(right.graph) ||
    left.stepperName.localeCompare(right.stepperName) ||
    left.source.length - right.source.length
  )
  .slice(0, 30)
  .map(row => [
    row.stepperName,
    row.family,
    row.topology,
    row.cycleKind,
    row.source,
    row.trend,
    row.result.trace.at(-1),
  ])

const boundarySources = [
  ['fresh boundary', 'fresh trees', '(x ())'],
  ['fully recursive', 'all finite graphs', '(@ @)'],
  ['raw left cycle', 'all finite graphs', '(@ x)'],
  ['raw right cycle', 'all finite graphs', '(x @)'],
  ['left-empty delay only', 'all finite graphs', '(() @)'],
  ['right-empty delay only', 'all finite graphs', '(@ ())'],
  ['right-growing stream', 'all finite graphs', '(x @1); @1=(() @)'],
  ['left-growing Z', 'all finite graphs', '(@1 x); @1=(() @)'],
  ['right-empty stream mirror', 'all finite graphs', '(x @1); @1=(@ ())'],
  ['right-empty Z mirror', 'all finite graphs', '(@1 x); @1=(@ ())'],
]

const boundaryRows = boundarySources.flatMap(([label, family, source]) =>
  results
    .filter(row => row.family === family && row.source === source)
    .map(row => [
      label,
      source,
      row.stepperName,
      row.result.status,
      row.result.carries ? 'yes' : 'no',
      row.trend,
      row.stateMode,
    ])
)

const acyclicProductive = results.filter(row =>
  row.topology !== 'cycle' &&
  row.result.status === 'survivor' &&
  row.result.carries
).length

const cyclicProductive = results.filter(row =>
  row.topology === 'cycle' &&
  row.result.status === 'survivor' &&
  row.result.carries
).length

const mutatingProductive = results.filter(row =>
  row.stepperName === 'mutating either step' &&
  row.result.status === 'survivor' &&
  row.result.carries
).length

const refOnlyPayload = results.filter(row =>
  row.family === 'fully recursive ref-only' &&
  row.result.carries
).length

const topLineRows = [
  ['Acyclic recurrence', String(acyclicProductive), 'No acyclic candidate survived while carrying x. Trees and DAGs remain finite fuses.'],
  ['Cyclic recurrence', String(cyclicProductive), 'All productive recurrence comes from cyclic topology.'],
  ['Mutating recurrence', String(mutatingProductive), 'The state-carrying observer did not produce a productive survivor in this bounded run.'],
  ['Ref-only payload', String(refOnlyPayload), 'Fully recursive ref-only structures contain no x; they are vacuum-like boundaries.'],
]

const decisionRows = [
  [
    'fresh tree',
    'legal finite history',
    'no',
    'Catalan/Dyck-like crossing-free possibility path; every pair is a new event.',
  ],
  [
    'shared DAG',
    'legal if crossings/confluence are allowed',
    'no',
    'Finite causal set with reused events; supports path-merging and compact common subwork.',
  ],
  [
    'raw cycle',
    'probably illegal as an event history',
    'unstable',
    'Usually collapses or over-recurses; a naked loop is not a causal clock.',
  ],
  [
    'delayed cycle',
    'legal only as recurrence/fixed-point law',
    'yes',
    'Compact infinite path-sum; observer crosses one delay boundary per tick.',
  ],
  [
    'fully recursive ref-only',
    'degenerate boundary',
    'no payload',
    'Pure reuse with no event content; useful as a vacuum-like boundary, not computation by itself.',
  ],
  [
    'state-carrying mutation',
    'separate machine semantics',
    'bounded in these motifs',
    'Observer identity matters; history is edited into state instead of emitted as a new path.',
  ],
]

const report = `# Legal Topology Report

Generated by \`node legal-topology-report.mjs ${freshMaxPairs} ${dagMaxNodes} ${exhaustiveMaxNodes} ${delayMax} ${steps} ${classifySteps} ${outputPath}\`.

This report extends \`causal-lattice-report.md\` toward a topology decision. It combines exhaustive small graph search with larger targeted families that mark the boundaries of the space: every pair fresh, shared acyclic pairs, all small finite recursive graphs, fully recursive ref-only graphs, delayed self-cycles, and delayed mutual cycles.

## Search Domains

${table(['Domain', 'Description', 'Candidates'], familyRows)}

Each candidate is evaluated against every stepper:

${table(['Stepper', 'Role'], [
  ['observe', 'left-empty depth-first pure observer'],
  ['right-empty step', 'right-empty depth-first experiment'],
  ['either-empty step', 'symmetric empty-pair observer'],
  ['local-only step', 'pair-local rewrite with no descent'],
  ['breadth-first step', 'one simultaneous observer layer'],
  ['mutating either step', 'state-carrying observer that edits pairs'],
])}

## Top-Line Findings

${table(['Question', 'Count', 'Interpretation'], topLineRows)}

## Productive Recurrence

These rows still changed after ${classifySteps} step(s) while retaining \`x\`.

${productiveRows.length
  ? table(['Stepper', 'Family', 'Topology', 'Cycle Kind', 'Trend', 'Count'], productiveRows)
  : 'No productive recurrence found.'}

## Smallest Productive Examples

${exampleRows.length
  ? table(['Stepper', 'Family', 'Topology', 'Cycle Kind', 'Structure', 'Trend', `Trace at ${steps}`], exampleRows)
  : 'No productive examples found.'}

## Boundary Cases

${table(['Name', 'Structure', 'Stepper', 'Status', 'Carries x', 'Trend', 'State Mode'], boundaryRows)}

## Topology Decision Matrix

${table(['Topology', 'Candidate Legality', 'Recurrence', 'Interpretation'], decisionRows)}

## Discussion

### The Two Boundaries

The fresh-tree boundary is the Catalan side of the space: every array is new, no sharing, no crossings, no cycles. It is the cleanest finite causal history. These structures normalize under every stepper in the tested bounds. They can carry information for a finite number of ticks, but they do not create recurrence.

The fully recursive boundary is the opposite: structure is only reference reuse, such as \`(@ @)\`. With no payload and no fresh event boundary, it is mostly vacuum-like. It can be stable, degenerate, or stepper-error-prone, but it does not by itself create meaningful causal history. This supports the idea that pure recurrence is not enough; a useful cyclic law also needs an observable boundary and content.

Some ref-only cycles can still make structure grow under recursive pure observers. I would not count that as computation yet: it is vacuum expansion without a distinguished payload. It may matter later if the vacuum itself becomes weighted.

### DAGs and Crossings

Shared DAGs sit between these boundaries. They allow crossings in the path picture: two future branches may share a past or intermediate event. If crossings are disallowed, the legal acyclic subspace is Dyck/Catalan-like. If crossings are allowed, the legal acyclic subspace becomes a finite causal DAG with confluence. In these runs, shared DAGs remain finite. They change bookkeeping and timing, not the basic causal fact that acyclic possibility spaces eventually normalize.

For probability theory, trees are sums over independent path shapes; shared DAGs are sums over paths with identified subevents. That distinction matters: sharing is not just compression, it says two histories have a common cause or common consequence.

### Cycles

Cycles are not automatically legal. Raw cycles like \`(@ x)\`, \`(x @)\`, and \`(@ @)\` either collapse, stabilize, or over-recurse depending on the observer. The productive cyclic structures are guarded or delayed. A delayed cycle behaves less like a literal event causing itself and more like a compact recurrence equation. The observer never consumes the whole loop at once; it crosses one observable boundary per tick.

That gives a possible legality rule:

- illegal as finite history: naked cycles
- legal as finite history: trees and DAGs
- legal as laws/generators: delayed cycles with explicit observer boundary

This is the main fork. If the model is only a causal set of completed events, cycles should be forbidden. If the model includes compact laws over possible histories, guarded cycles are meaningful and probably necessary for recurrence.

### Left, Right, and Gauge

Plain \`observe\` is handed: left-empty delay is meaningful, while right-empty delay can be too hot or invisible. \`either-empty step\` and \`breadth-first step\` make both handed versions productive. That makes handedness partly a stepper choice. If left/right orientation is intended to be gauge, \`either-empty\` or a carefully designed symmetric observer is more honest. If orientation is intended to encode causal direction, the current \`observe\` has a real arrow.

### Pair-Local and Mutating Observers

\`local-only step\` is pair-local and does not recurse. It is useful as a lower boundary: nothing distant happens unless the focus is already at the redex. It tends to stabilize structures that recursive observers unfold.

\`mutating either step\` is state-carrying. It edits the graph instead of emitting a new graph as observer time. That can be a valid abstract machine, but it is not the same semantics as a path expansion. In the tested productive motifs, mutation usually collapses recurrence into bounded state. So if the goal is probability over causal paths, pure observers look more natural. If the goal is a machine with memory, mutating observers remain viable but should be called out as machine semantics.

### Probability and Causal Theory

The topology choice determines the probability space:

- Trees: probability over Catalan/Dyck-like paths.
- DAGs: probability over paths with shared events or crossings.
- Delayed cycles: probability over infinite path families, recurrence classes, or fixed-point-generated histories.

If cycles are admitted, weights must account for infinite unfolding. That suggests using fixed-point equations, generating functions, stationary measures, or recurrence-class weights rather than simple finite path counts. If cycles are forbidden, the model stays closer to finite causal-set probability and ordinary Catalan enumeration.

## Recommendation

For a conservative causal interpretation:

1. Legal finite structures: trees and shared DAGs.
2. Illegal finite structures: raw cycles.
3. Optional higher-level laws: guarded/delayed cycles, explicitly marked as recurrence generators rather than ordinary events.
4. Keep pure observers separate from state-carrying observers.

That gives more than one correct way to proceed:

- **Finite causal-set model:** forbid cycles, allow or disallow DAG crossings depending on whether shared events are real.
- **Computational fixed-point model:** allow delayed cycles as compact infinite histories.
- **State-machine model:** allow mutating observers, but treat results as state evolution rather than path expansion.

The current evidence favors trees/DAGs as legal event topology and delayed cycles as legal only when interpreted as laws over the topology.

## Appendix: Full Outcome Matrix

${table(['Stepper', 'Family', 'Topology', 'Status', 'Carries x', 'Trend', 'State Mode', 'Count'], outcomeRows)}
`

writeFileSync(outputPath, report)
console.log(`wrote ${outputPath}`)
console.log(`families: ${families.length}`)
console.log(`candidates: ${families.reduce((sum, family) => sum + family.candidates.length, 0)}`)
console.log(`results: ${results.length}`)
