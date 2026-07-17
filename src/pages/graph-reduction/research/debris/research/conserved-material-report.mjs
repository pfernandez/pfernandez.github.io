import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  empty,
  observe as conservedObserve,
  collectPairs,
  isConserved,
  I,
  K,
  S,
  Z,
} from './conserved-material.mjs'
import { observe as consingObserve } from '../observe.mjs'
import { serialize } from '../serialize.mjs'

const maxPairs = Number(process.argv[2] ?? 3)
const steps = Number(process.argv[3] ?? 8)
const outputPath = process.argv[4] ?? new URL('./conserved-material-report.md', import.meta.url)

const isPair = node =>
  Array.isArray(node) && node.length !== 0

const isEmpty = node =>
  Array.isArray(node) && node.length === 0

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

const rewireObserve = root => {
  const step = focus => {
    if (!isPair(focus)) {
      return { focus, changed: false }
    }

    const [first, rest] = focus

    if (first === focus || isEmpty(first)) {
      return { focus: rest, changed: rest !== focus }
    }

    const nextFirst = step(first)
    if (nextFirst.changed) {
      focus[0] = nextFirst.focus
      return { focus, changed: true }
    }

    const nextRest = step(rest)
    if (nextRest.changed) {
      focus[1] = nextRest.focus
      return { focus, changed: true }
    }

    return { focus, changed: false }
  }

  return step(root).focus
}

const observerRows = [
  ['conserved selector', conservedObserve],
  ['conserved rewire', rewireObserve],
  ['allocating observe', consingObserve],
]

const run = (observer, root) => {
  const initialPairs = collectPairs(root)
  const seen = new Map()
  const states = []
  let focus = root

  for (let step = 0; step <= steps; step++) {
    const conserved = isConserved(initialPairs, focus)
    const key = observer === rewireObserve
      ? serialize(focus)
      : focus

    states.push(focus)

    if (!conserved) {
      return {
        status: 'escaped',
        conserved,
        states,
        cycleStart: undefined,
        cycleLength: undefined,
        carriesX: states.every(state => contains(state, 'x')),
      }
    }

    if (seen.has(key)) {
      return {
        status: 'cycle',
        conserved,
        states,
        cycleStart: seen.get(key),
        cycleLength: step - seen.get(key),
        carriesX: states.every(state => contains(state, 'x')),
      }
    }

    seen.set(key, step)

    try {
      focus = observer(focus)
    } catch (error) {
      return {
        status: 'error',
        conserved,
        states,
        cycleStart: undefined,
        cycleLength: undefined,
        carriesX: states.every(state => contains(state, 'x')),
        error: error.message,
      }
    }
  }

  return {
    status: 'limit',
    conserved: isConserved(initialPairs, focus),
    states,
    cycleStart: undefined,
    cycleLength: undefined,
    carriesX: states.every(state => contains(state, 'x')),
  }
}

const sampleRows = () => {
  const forms = [
    ['I', () => I('x'), 'x'],
    ['K', () => K('x', 'y'), 'x'],
    ['S', () => S('x', 'y', 'z'), '((x z) (y z))'],
    ['Z', () => Z('x'), 'periodic x carrier'],
  ]

  return observerRows.flatMap(([observerName, observer]) =>
    forms.map(([formName, build, expected]) => {
      const result = run(observer, build())
      const last = result.states.at(-1)

      return {
        observerName,
        formName,
        expected,
        status: result.status,
        conserved: result.conserved,
        cycleLength: result.cycleLength,
        carriesX: result.carriesX,
        last: serialize(last),
      }
    })
  )
}

const reachableNodes = root => {
  const seen = new Set()

  const visit = node => {
    if (!isPair(node) || seen.has(node)) return

    seen.add(node)
    node.forEach(visit)
  }

  visit(root)
  return seen
}

const buildGraph = (pairCount, code) => {
  const nodes = Array.from({ length: pairCount }, () => [])
  const optionCount = pairCount + 2
  let remaining = code

  const readSlot = () => {
    const option = remaining % optionCount
    remaining = Math.floor(remaining / optionCount)

    if (option === 0) return empty
    if (option === 1) return 'x'

    return nodes[option - 2]
  }

  for (const node of nodes) {
    node[0] = readSlot()
    node[1] = readSlot()
  }

  return nodes[0]
}

const candidateCount = pairCount =>
  (pairCount + 2) ** (pairCount * 2)

const searchCycles = () => {
  const hits = []
  const totals = []

  for (let pairCount = 1; pairCount <= maxPairs; pairCount++) {
    let connected = 0
    let periodic = 0
    const total = candidateCount(pairCount)

    for (let code = 0; code < total; code++) {
      const root = buildGraph(pairCount, code)
      const reachable = reachableNodes(root)

      if (reachable.size !== pairCount) continue
      connected += 1

      const result = run(conservedObserve, root)
      const isPeriodic = result.cycleLength !== undefined && result.cycleLength > 1

      if (!isPeriodic || !result.conserved || !result.carriesX) continue

      periodic += 1

      if (hits.length < 256) {
        hits.push({
          pairCount,
          form: serialize(root),
          cycleStart: result.cycleStart,
          cycleLength: result.cycleLength,
          orbit: result.states.map(serialize),
        })
      }
    }

    totals.push({ pairCount, total, connected, periodic })
  }

  return { totals, hits }
}

const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map(row => `| ${row.join(' | ')} |`),
].join('\n')

const render = () => {
  const samples = sampleRows()
  const { totals, hits } = searchCycles()
  const minimalPairCount = hits[0]?.pairCount
  const selectedHit = hits.find(hit =>
    hit.pairCount === minimalPairCount && hit.form.startsWith('(x ')
  ) ?? hits[0]

  const lines = [
    '# Conserved Material Report',
    '',
    'This report tests the stronger rule that observation may select existing graph material but may not create a new pair after the initial structure is built.',
    '',
    'The candidate observer used for the extracted machine is the conserved selector:',
    '',
    '```js',
    'if the focus is not a non-empty pair, return it',
    'if the left slot is empty or self, return the right slot',
    'otherwise observe the left slot',
    'if that selected something, return it directly',
    'otherwise observe the right slot',
    'if that selected something, return it directly',
    'otherwise return the focus',
    '```',
    '',
    'It never returns `[left, right]`. It either returns the current focus or an already-existing node reachable from the initial graph.',
    '',
    '## Hand-Built Forms',
    '',
    table(
      ['observer', 'form', 'expected', 'conserved', 'cycle', 'carries x', 'last seen'],
      samples.map(row => [
        row.observerName,
        row.formName,
        row.expected,
        `${row.status}/${row.conserved}`,
        row.cycleLength === undefined ? '' : String(row.cycleLength),
        String(row.carriesX),
        `\`${row.last}\``,
      ])
    ),
    '',
    '## Minimal Recurrent Search',
    '',
    `The search enumerated every connected rooted graph through ${maxPairs} non-empty pair nodes. Slots may contain the shared empty pair, atom \`x\`, or a reference to any pair node. The observer is the conserved selector.`,
    '',
    table(
      ['pair nodes', 'raw candidates', 'connected candidates', 'periodic x carriers'],
      totals.map(row => [
        String(row.pairCount),
        String(row.total),
        String(row.connected),
        String(row.periodic),
      ])
    ),
    '',
  ]

  if (selectedHit) {
    lines.push(
      'A smallest periodic carrier with `x` visible at the root:',
      '',
      `- pairs: ${selectedHit.pairCount}`,
      `- form: \`${selectedHit.form}\``,
      `- cycle: start ${selectedHit.cycleStart}, length ${selectedHit.cycleLength}`,
      `- orbit: ${selectedHit.orbit.map(item => `\`${item}\``).join(' → ')}`,
      '',
      'One readable spelling of the same graph is:',
      '',
      '```js',
      'const A = []',
      'const D = []',
      'const B = []',
      '',
      "A[0] = 'x'",
      'A[1] = D',
      'D[0] = empty',
      'D[1] = B',
      'B[0] = empty',
      'B[1] = A',
      '```',
      '',
      'Observation alternates `A → B → A`. The second state does not have `x` in the left slot, but `x` is still reachable through `A`, so the payload is conserved rather than copied.'
    )
  } else {
    lines.push('No periodic x carrier was found in the bounded search.')
  }

  lines.push(
    '',
    '## Interpretation',
    '',
    '- The allocating observer is a history-producing rule: it can preserve context by creating a fresh parent pair.',
    '- The conserved rewire observer preserves material, but it changes existing links and tends to collapse recurrence into a normal form.',
    '- The conserved selector is the smallest pure version: it treats observation as choosing a reachable history rather than building a new one.',
    '- Finite computation must be latent in the initial graph. `S` therefore contains the shared result shape `((x z) (y z))` before observation.',
    '- Infinite behavior cannot be an expanding list of new states. In a conserved finite graph, `Z` becomes a periodic orbit through existing states.',
    '- This makes double-slit-style selection plausible: alternatives are not manufactured by observation, and recombination is shared topology.',
    '- This also makes entanglement topological: separated observations can correlate only by sharing conserved substructure.',
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
