import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { serialize } from '../serialize.mjs'

const maxPairs = Number(process.argv[2] ?? 4)
const steps = Number(process.argv[3] ?? 8)
const outputPath = process.argv[4] ?? 'minimal-material-report.md'

const isPair = node =>
  Array.isArray(node) && node.length !== 0

const isEmpty = node =>
  Array.isArray(node) && node.length === 0

const observe = (focus, active = new Set()) => {
  if (!isPair(focus)) return focus
  if (active.has(focus)) throw new Error('recursive descent')

  active.add(focus)

  try {
    const [first, rest] = focus

    if (first === focus || isEmpty(first)) return rest

    const nextFirst = observe(first, active)
    if (nextFirst !== first) return nextFirst

    const nextRest = observe(rest, active)
    if (nextRest !== rest) return nextRest

    return focus
  } finally {
    active.delete(focus)
  }
}

const reachableNodes = root => {
  const nodes = new Set()

  const visit = node => {
    if (!isPair(node) || nodes.has(node)) return

    nodes.add(node)
    node.forEach(visit)
  }

  visit(root)
  return nodes
}

const contains = (root, value) => {
  const seen = new Set()

  const visit = node => {
    if (node === value) return true
    if (!Array.isArray(node) || seen.has(node)) return false

    seen.add(node)
    return node.some(visit)
  }

  return visit(root)
}

const permutations = items => {
  if (items.length === 0) return [[]]

  return items.flatMap((item, index) => {
    const before = items.slice(0, index)
    const after = items.slice(index + 1)

    return permutations([...before, ...after]).map(rest => [item, ...rest])
  })
}

const canonical = root => {
  if (isEmpty(root)) return '()'
  if (!isPair(root)) return String(root)

  const nodes = [...reachableNodes(root)]
  const others = nodes.filter(node => node !== root)

  const encodeWith = order => {
    const ordered = [root, ...order]
    const indexes = new Map(ordered.map((node, index) => [node, index]))

    const encodeSlot = slot => {
      if (isEmpty(slot)) return '()'
      if (isPair(slot)) return `@${indexes.get(slot)}`
      return String(slot)
    }

    return ordered
      .map(node => `(${encodeSlot(node[0])},${encodeSlot(node[1])})`)
      .join(';')
  }

  return permutations(others)
    .map(encodeWith)
    .sort()[0]
}

const run = root => {
  const seen = new Map()
  const states = []
  let focus = root

  for (let step = 0; step <= steps; step++) {
    states.push(focus)

    if (seen.has(focus)) {
      return {
        status: 'cycle',
        cycleStart: seen.get(focus),
        cycleLength: step - seen.get(focus),
        states,
      }
    }

    seen.set(focus, step)

    try {
      focus = observe(focus)
    } catch (error) {
      return {
        status: 'error',
        cycleStart: undefined,
        cycleLength: undefined,
        states,
        error: error.message,
      }
    }
  }

  return {
    status: 'limit',
    cycleStart: undefined,
    cycleLength: undefined,
    states,
  }
}

const cycleStates = result => {
  if (result.status !== 'cycle') return []

  const start = result.cycleStart
  const end = start + result.cycleLength

  return result.states.slice(start, end)
}

const cycleShapeCount = result =>
  new Set(cycleStates(result).map(canonical)).size

const cycleCarriesX = result => {
  const states = cycleStates(result)

  return states.length !== 0 && states.every(state => contains(state, 'x'))
}

const buildGraph = (pairCount, code, budget) => {
  const nodes = Array.from({ length: pairCount }, () => [])
  const options = [...nodes]

  if (budget.empty) options.push([])
  if (budget.x) options.push('x')

  const base = options.length
  let remaining = code

  for (const node of nodes) {
    node[0] = options[remaining % base]
    remaining = Math.floor(remaining / base)

    node[1] = options[remaining % base]
    remaining = Math.floor(remaining / base)
  }

  return nodes[0]
}

const candidateCount = (pairCount, budget) => {
  const slotOptions = pairCount +
    (budget.empty ? 1 : 0) +
    (budget.x ? 1 : 0)

  return slotOptions ** (pairCount * 2)
}

const budgets = [
  ['refs only', { empty: false, x: false }],
  ['refs + empty', { empty: true, x: false }],
  ['refs + x', { empty: false, x: true }],
  ['refs + empty + x', { empty: true, x: true }],
]

const summarize = () =>
  budgets.map(([name, budget]) => {
    const rows = []
    const examples = {}

    for (let pairCount = 1; pairCount <= maxPairs; pairCount++) {
      const total = candidateCount(pairCount, budget)
      const stats = {
        total,
        connected: 0,
        moved: 0,
        pointerCycles: 0,
        visibleCycles: 0,
        xCycles: 0,
        errors: 0,
      }

      for (let code = 0; code < total; code++) {
        const root = buildGraph(pairCount, code, budget)

        if (reachableNodes(root).size !== pairCount) continue

        stats.connected += 1

        const result = run(root)
        const moved = result.states[1] !== undefined && result.states[1] !== result.states[0]
        const nontrivialCycle = result.status === 'cycle' && result.cycleLength > 1
        const shapeCount = cycleShapeCount(result)
        const pointerCycle = nontrivialCycle && shapeCount === 1
        const visibleCycle = nontrivialCycle && shapeCount > 1
        const xCycle = visibleCycle && cycleCarriesX(result)

        if (moved) {
          stats.moved += 1
          examples.moved ??= { pairCount, root, result }
        }

        if (pointerCycle) {
          stats.pointerCycles += 1
          examples.pointerCycle ??= { pairCount, root, result }
        }

        if (visibleCycle) {
          stats.visibleCycles += 1
          examples.visibleCycle ??= { pairCount, root, result }
        }

        if (xCycle) {
          stats.xCycles += 1
          examples.xCycle ??= { pairCount, root, result }
        }

        if (result.status === 'error') stats.errors += 1
      }

      rows.push({ pairCount, ...stats })
    }

    return { name, rows, examples }
  })

const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
].join('\n')

const orbitText = result =>
  result.states
    .slice(0, result.cycleStart + result.cycleLength + 1)
    .map(state => `\`${serialize(state)}\``)
    .join(' → ')

const exampleLine = (label, example) => {
  if (!example) return `- ${label}: not found in this bound.`

  const result = example.result
  const cycle = result.cycleLength === undefined
    ? result.status
    : `${result.status}, start ${result.cycleStart}, length ${result.cycleLength}`

  return [
    `- ${label}: ${example.pairCount} pair nodes, \`${serialize(example.root)}\`, ${cycle}.`,
    `  Orbit: ${orbitText(result)}.`,
  ].join('\n')
}

const render = () => {
  const summaries = summarize()

  const lines = [
    '# Minimal Material Report',
    '',
    'This report asks how little initial graph material is needed when the observer is conserved: it may recurse and select, but it may not allocate a fresh pair and it may not mutate links.',
    '',
    'A non-empty pair node is counted as material. A shared empty leaf `()` and an atom `x` are optional slot values. The atom is only a dye marker; the pair-only rows are the important lower bound.',
    '',
    'Cycle classes:',
    '',
    '- Pointer cycle: the focus alternates by object identity, but the rooted graph shape is the same.',
    '- Visible cycle: the focus alternates and the rooted graph shape changes.',
    '- x cycle: a visible cycle whose cycle states all still reach `x`.',
    '',
    '## Budget Search',
    '',
  ]

  for (const summary of summaries) {
    lines.push(
      `### ${summary.name}`,
      '',
      table(
        ['pairs', 'connected', 'moved', 'pointer cycles', 'visible cycles', 'x cycles', 'errors'],
        summary.rows.map(row => [
          String(row.pairCount),
          String(row.connected),
          String(row.moved),
          String(row.pointerCycles),
          String(row.visibleCycles),
          String(row.xCycles),
          String(row.errors),
        ])
      ),
      ''
    )
  }

  const refsOnly = summaries.find(summary => summary.name === 'refs only')
  const refsAndX = summaries.find(summary => summary.name === 'refs + x')
  const full = summaries.find(summary => summary.name === 'refs + empty + x')

  lines.push(
    '## Smallest Examples',
    '',
    'Strict one-node vacuum:',
    '',
    '```js',
    'const A = []',
    'A[0] = A',
    'A[1] = A',
    '```',
    '',
    'This is conserved and stable: `($ $) -> ($ $)`. A single self-reference does not unfold a distinguishable pattern.',
    '',
    exampleLine('Smallest pair-only pointer cycle', refsOnly.examples.pointerCycle),
    exampleLine('Smallest pair-only visible cycle', refsOnly.examples.visibleCycle),
    exampleLine('Smallest dyed visible cycle without empty', refsAndX.examples.xCycle),
    exampleLine('Smallest dyed visible cycle with empty allowed', full.examples.xCycle),
    '',
    'One readable spelling of the smallest pair-only visible cycle is:',
    '',
    '```js',
    'const A = []',
    'const B = []',
    'const C = []',
    '',
    'A[0] = A',
    'A[1] = B',
    '',
    'B[0] = B',
    'B[1] = C',
    '',
    'C[0] = A',
    'C[1] = A',
    '```',
    '',
    'Its orbit is `A -> B -> C -> B ...`. The first tick enters the recurrent region; after that the observer alternates between two different rooted views of the same conserved material.',
    '',
    '## Conclusion',
    '',
    '- One pair node is enough for vacuum, but not for distinguishable recurrence.',
    '- Two pair nodes are enough for a hidden clock if object identity counts, but not if only rooted shape counts.',
    '- Three pair nodes are enough for visible pair-only recurrence. No `x` and no empty pair are required.',
    '- A dye marker `x` does not make recurrence possible; it only makes carried identity easier to see.',
    '- The minimal conserved substrate for observable pattern is therefore three non-empty pair nodes under the current left-self selector.',
    ''
  )

  return lines.join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const markdown = render()
  writeFileSync(outputPath, markdown)
  console.log(`wrote ${outputPath}`)
}

export { render }
