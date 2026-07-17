import { writeFileSync } from 'node:fs'
import { steppers } from './observer-variants.mjs'

const wrapperMaxNodes = Number(process.argv[2] ?? 3)
const holdSteps = Number(process.argv[3] ?? 8)
const outputPath = process.argv[4] ?? new URL('./quote-holding-report.md', import.meta.url)
const serializeLimit = 30_000

const hole = Symbol('hole')

const serialize = graph => {
  let used = 0

  const print = (node, path = '$', seen = new Map()) => {
    if (used > serializeLimit) return '...'
    if (node === hole) return 'H'
    if (!Array.isArray(node)) return String(node)
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

const canonical = graph => {
  const seen = new Map()
  let nextId = 0

  const print = node => {
    if (node === hole) return 'H'
    if (!Array.isArray(node)) return String(node)
    if (node.length === 0) return 'E'
    if (seen.has(node)) return `@${seen.get(node)}`

    const id = nextId
    nextId += 1
    seen.set(node, id)

    return `@${id}(${print(node[0])},${print(node[1])})`
  }

  return print(graph)
}

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

const countExact = (graph, target, seen = new Set()) => {
  let count = graph === target ? 1 : 0

  if (!Array.isArray(graph) || graph.length === 0 || seen.has(graph)) return count

  seen.add(graph)
  count += countExact(graph[0], target, seen)
  count += countExact(graph[1], target, seen)

  return count
}

const countTopology = (graph, targetCanonical, seen = new Set()) => {
  let count = canonical(graph) === targetCanonical ? 1 : 0

  if (!Array.isArray(graph) || graph.length === 0 || seen.has(graph)) return count

  seen.add(graph)
  count += countTopology(graph[0], targetCanonical, seen)
  count += countTopology(graph[1], targetCanonical, seen)

  return count
}

const forms = [
  {
    name: 'empty I',
    source: 'I = ()',
    build: () => [],
  },
  {
    name: 'event',
    source: '(() ())',
    build: () => [[], []],
  },
  {
    name: 'left delay',
    source: '(() (() ()))',
    build: () => [[], [[], []]],
  },
  {
    name: 'right delay',
    source: '((() ()) ())',
    build: () => [[[], []], []],
  },
  {
    name: 'shared event',
    source: '(I I), I=()',
    build: () => {
      const I = []
      return [I, I]
    },
  },
  {
    name: 'fresh fork',
    source: '((() ()) (() ()))',
    build: () => [[[], []], [[], []]],
  },
  {
    name: 'self left',
    source: 'R=(R ())',
    build: () => {
      const graph = []
      graph[0] = graph
      graph[1] = []
      return graph
    },
  },
  {
    name: 'self both',
    source: 'R=(R R)',
    build: () => {
      const graph = []
      graph[0] = graph
      graph[1] = graph
      return graph
    },
  },
]

const choiceLabels = nodeCount => [
  { label: 'H', kind: 'hole' },
  { label: '()', kind: 'empty' },
  ...Array.from({ length: nodeCount }, (_, index) => ({
    label: index === 0 ? '@' : `@${index}`,
    kind: 'ref',
    ref: index,
  })),
]

const reachableWrapperNodes = slots => {
  const seen = new Set()

  const visitNode = index => {
    if (seen.has(index)) return
    seen.add(index)
    visitSlot(slots[index * 2])
    visitSlot(slots[index * 2 + 1])
  }

  const visitSlot = slot => {
    if (slot.kind === 'ref') visitNode(slot.ref)
  }

  visitNode(0)
  return seen.size
}

const formatTemplate = slots => {
  const parts = []

  for (let index = 0; index < slots.length / 2; index += 1) {
    parts.push(`@${index}=(${slots[index * 2].label} ${slots[index * 2 + 1].label})`)
  }

  return parts.join('; ').replace('@0=', '')
}

const buildTemplate = (slots, form) => {
  const nodes = Array.from({ length: slots.length / 2 }, () => [])

  const value = slot => {
    if (slot.kind === 'hole') return form
    if (slot.kind === 'empty') return []
    return nodes[slot.ref]
  }

  for (let index = 0; index < nodes.length; index += 1) {
    nodes[index][0] = value(slots[index * 2])
    nodes[index][1] = value(slots[index * 2 + 1])
  }

  return nodes[0]
}

const holeCount = slots => slots.filter(slot => slot.kind === 'hole').length

const generateTemplates = maxNodes => {
  const templates = []

  for (let nodeCount = 1; nodeCount <= maxNodes; nodeCount += 1) {
    const slots = []
    const choices = choiceLabels(nodeCount)

    const visit = depth => {
      if (depth === nodeCount * 2) {
        if (holeCount(slots) === 0) return
        if (reachableWrapperNodes(slots) !== nodeCount) return

        templates.push({
          source: formatTemplate(slots),
          holes: holeCount(slots),
          nodeCount,
          slots: slots.map(slot => ({ ...slot })),
        })
        return
      }

      for (const choice of choices) {
        slots.push(choice)
        visit(depth + 1)
        slots.pop()
      }
    }

    visit(0)
  }

  return templates
}

const changesByItself = (formBuilder, stepper) => {
  const form = formBuilder()
  const before = canonical(form)

  try {
    return canonical(stepper(form)) !== before
  } catch {
    return true
  }
}

const traceHold = ({ form, formCanonical, graph, stepper }) => {
  let current = graph
  const rows = []

  for (let index = 0; index <= holdSteps; index += 1) {
    rows.push({
      step: index,
      text: serialize(current),
      exact: countExact(current, form),
      topology: countTopology(current, formCanonical),
    })

    if (index === holdSteps) break

    try {
      current = stepper(current)
    } catch (error) {
      return {
        status: 'error',
        detail: error.message,
        rows,
      }
    }
  }

  const first = rows[0].text
  const last = rows.at(-1).text
  const exactHeld = rows.every(row => row.exact > 0)
  const topologyHeld = rows.every(row => row.topology > 0)
  const stable = rows.length > 1 && rows.at(-1).text === rows.at(-2).text

  return {
    status: stable ? 'stable' : first === last ? 'periodic' : 'changed',
    detail: String(holdSteps),
    rows,
    exactHeld,
    topologyHeld,
  }
}

const templates = generateTemplates(wrapperMaxNodes)
const results = []

for (const template of templates) {
  for (const formSpec of forms) {
    for (const [stepperName, stepper] of steppers) {
      const reducible = changesByItself(formSpec.build, stepper)
      const form = formSpec.build()
      const graph = buildTemplate(template.slots, form)
      const formCanonical = canonical(form)
      const result = traceHold({ form, formCanonical, graph, stepper })

      results.push({
        template,
        form: formSpec,
        stepperName,
        reducible,
        result,
        quoteLike: reducible && result.exactHeld,
        topologyHold: reducible && result.topologyHeld,
        letLike: template.holes > 1 && result.exactHeld,
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

const count = predicate => results.filter(predicate).length

const topRows = [
  ['Templates searched', String(templates.length), `wrappers up to ${wrapperMaxNodes} pair node(s), each with at least one hole`],
  ['Quote-like exact holds', String(count(row => row.quoteLike)), 'a reducible form remains present by exact reference through the run'],
  ['Static exact holds', String(count(row => row.quoteLike && ['stable', 'periodic'].includes(row.result.status))), 'the held form remains and the wrapper reaches a stable or periodic holder'],
  ['Dynamic exact holds', String(count(row => row.quoteLike && row.result.status === 'changed')), 'the held form remains while the surrounding structure keeps changing'],
  ['Topology-only holds', String(count(row => row.topologyHold && !row.quoteLike)), 'the same unlabeled topology remains, but not necessarily the same object'],
  ['Let-like shared holds', String(count(row => row.letLike)), 'the same reducible form is shared in multiple holes and remains held'],
]

const outcomeRows = [...results.reduce((counts, row) => {
  increment(counts, `${row.stepperName}|${row.form.name}|${row.result.status}|${row.reducible ? 'yes' : 'no'}|${row.result.exactHeld ? 'yes' : 'no'}|${row.result.topologyHeld ? 'yes' : 'no'}`)
  return counts
}, new Map())]
  .sort()
  .map(([key, value]) => [...key.split('|'), String(value)])

const quoteRows = results
  .filter(row => row.quoteLike)
  .sort((left, right) =>
    left.stepperName.localeCompare(right.stepperName) ||
    left.template.nodeCount - right.template.nodeCount ||
    left.template.holes - right.template.holes ||
    left.template.source.length - right.template.source.length
  )
  .slice(0, 40)
  .map(row => [
    row.stepperName,
    row.form.name,
    row.template.holes,
    row.template.source,
    row.result.status,
    row.result.rows.at(-1).text,
  ])

const staticQuoteRows = results
  .filter(row => row.quoteLike && ['stable', 'periodic'].includes(row.result.status))
  .sort((left, right) =>
    left.stepperName.localeCompare(right.stepperName) ||
    left.template.nodeCount - right.template.nodeCount ||
    left.template.holes - right.template.holes ||
    left.template.source.length - right.template.source.length
  )
  .slice(0, 30)
  .map(row => [
    row.stepperName,
    row.form.name,
    row.template.holes,
    row.template.source,
    row.result.status,
    row.result.rows.at(-1).text,
  ])

const letRows = results
  .filter(row => row.letLike)
  .sort((left, right) =>
    left.stepperName.localeCompare(right.stepperName) ||
    left.template.nodeCount - right.template.nodeCount ||
    left.template.source.length - right.template.source.length
  )
  .slice(0, 30)
  .map(row => [
    row.stepperName,
    row.form.name,
    row.template.holes,
    row.template.source,
    row.result.status,
    row.result.rows.at(-1).text,
  ])

const topologyRows = results
  .filter(row => row.topologyHold && !row.quoteLike)
  .sort((left, right) =>
    left.stepperName.localeCompare(right.stepperName) ||
    left.template.nodeCount - right.template.nodeCount ||
    left.template.source.length - right.template.source.length
  )
  .slice(0, 30)
  .map(row => [
    row.stepperName,
    row.form.name,
    row.template.holes,
    row.template.source,
    row.result.status,
    row.result.rows.at(-1).text,
  ])

const report = `# Quote and Holding Report

Generated by \`node quote-holding-report.mjs ${wrapperMaxNodes} ${holdSteps} ${outputPath}\`.

This report searches for pair-only wrappers \`Q(H)\` that can hold a reducible form without labels or metadata. A form counts as quote-like for a stepper when:

1. the form would reduce if observed directly,
2. the wrapper contains the form as a hole,
3. the exact form reference is still present after ${holdSteps} observer tick(s).

The topology-only check uses an unlabeled rooted graph canonical form, so path names like \`$[0][1]\` do not count as real structure.

## Top-Line Findings

${table(['Question', 'Count', 'Meaning'], topRows)}

## Quote-Like Exact Holds

${quoteRows.length
  ? table(['Stepper', 'Form', 'Holes', 'Wrapper', 'Status', `Trace at ${holdSteps}`], quoteRows)
  : 'No exact quote-like holders found.'}

## Static Exact Holds

${staticQuoteRows.length
  ? table(['Stepper', 'Form', 'Holes', 'Wrapper', 'Status', `Trace at ${holdSteps}`], staticQuoteRows)
  : 'No static exact holders found.'}

## Let-Like Shared Holds

${letRows.length
  ? table(['Stepper', 'Form', 'Holes', 'Wrapper', 'Status', `Trace at ${holdSteps}`], letRows)
  : 'No let-like shared holders found.'}

## Topology-Only Holds

${topologyRows.length
  ? table(['Stepper', 'Form', 'Holes', 'Wrapper', 'Status', `Trace at ${holdSteps}`], topologyRows)
  : 'No topology-only holders found.'}

## Outcome Matrix

${table(['Stepper', 'Form', 'Status', 'Reducible Alone', 'Exact Held', 'Topology Held', 'Count'], outcomeRows)}

## Discussion

### Can Pure Reference Hold Pattern?

Yes, but the interesting cases split into three classes. Static exact holds are closest to \`quote\`: the observer reaches a stable or periodic wrapper while the reducible form remains unentered by exact reference. Dynamic exact holds are more like a protected seed inside an active generator: the surrounding knot keeps unfolding, but the form is still held. Topology-only holds preserve a shape but not necessarily the same object. Those are weaker; they look more like regeneration than quotation.

### Let vs Quote

\`let\` is ordinary sharing: the same form appears in multiple holes. If those references remain exact, the wrapper is a let-like holder. That is less mysterious than quote because the graph identity itself is the binding.

\`quote\` requires an observational boundary. It is not enough to share the form; the wrapper must prevent the observer from entering a form that would otherwise reduce.

### Collapse as Compression

When a wrapper collapses but preserves the ability to regenerate later structure, it supports the compression reading: the observer discards material that is not needed for future generation. In this report, exact quote-like holds are the opposite behavior: material is protected because entering it would change the future-generating pattern.

### Caution

The search is bounded. It covers wrappers through ${wrapperMaxNodes} pair node(s), the listed forms, and ${holdSteps} ticks. Larger wrappers may reveal cleaner quote/unquote pairs. The current result is enough to distinguish three ideas: exact holding, topology-only regeneration, and simple sharing.
`

writeFileSync(outputPath, report)
console.log(`wrote ${outputPath}`)
console.log(`templates: ${templates.length}`)
console.log(`results: ${results.length}`)
