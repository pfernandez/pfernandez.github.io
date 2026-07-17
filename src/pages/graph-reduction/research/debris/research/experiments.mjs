import { readFileSync } from 'node:fs'
import { compile as compileSource } from '../compile.mjs'
import { steppers } from './observer-variants.mjs'
import { serialize } from '../serialize.mjs'

const core = readFileSync(new URL('../source.lisp', import.meta.url), 'utf8')
const steps = Number(process.argv[2] ?? 8)

// Future axis: add broader DAG-sharing patterns here before changing the
// observer. Keep cyclic rows as explicit baselines, so cycles do not hide which
// finite shape/stepper combinations actually carry information.

const hasCycle = (node, seen = new Set()) => {
  if (!Array.isArray(node) || node.length === 0) return false
  if (seen.has(node)) return true

  return node.some(child => hasCycle(child, new Set([...seen, node])))
}

const compileSlotDag = (motif, args) => {
  const registry = new Map()

  const build = node => {
    if (typeof node === 'number') {
      if (!registry.has(node)) {
        let value = args[node]
        for (let tick = 0; tick < node; tick += 1) value = [value, []]
        registry.set(node, value)
      }

      return registry.get(node)
    }

    if (!Array.isArray(node)) return node

    const pair = [build(node[0]), build(node[1])]
    if (hasCycle(pair)) throw new Error('causality violation')
    return pair
  }

  return build(motif)
}

const sourceGraph = source => {
  const state = compileSource(`${core}\n${source}`)
  if (state.error) throw new Error(state.error)
  return state.graph
}

const cyclicZ = () => {
  const graph = []
  graph[0] = []
  graph[1] = 'x'
  graph[0][0] = []
  graph[0][1] = graph
  return graph
}

const leftSlot = () => [[], 'x']

const rightSlot = () => ['x', []]

const leftSlotDelay = () => [[], [[], 'x']]

const rightSlotDelay = () => [['x', []], []]

const emptyS = () => [[[], []], [['a', 'c'], ['b', 'c']]]

const slotS = () => compileSlotDag([[0, 2], [1, 2]], ['a', 'b', 'c'])

const builders = [
  ['empty S motif', emptyS, 'c'],
  ['slot DAG S motif', slotS, 'c'],
  ['left slot x', leftSlot, 'x'],
  ['right slot x', rightSlot, 'x'],
  ['left slot delay x', leftSlotDelay, 'x'],
  ['right slot delay x', rightSlotDelay, 'x'],
  ['source S', () => sourceGraph('(((S a) b) c)'), 'c'],
  ['cyclic Z', cyclicZ, 'x'],
  [
    'source recursive carry',
    () => sourceGraph(`
      (defn carry (x) (carry x))
      (carry x)
    `),
    'x',
  ],
  [
    'source traditional Z',
    () => sourceGraph(`
      (defn force (again) (again x))
      (Z force)
    `),
    'x',
  ],
]

const tokenPattern = token => new RegExp(`\\b${token}\\b`)

const run = (builderName, build, token, stepperName, stepper) => {
  let graph = build()
  const initialCycle = hasCycle(graph)
  const trace = [serialize(graph)]
  let stableAt
  let error

  for (let tick = 1; tick <= steps; tick += 1) {
    let next

    try {
      next = stepper(graph)
    } catch (caught) {
      error = caught.message
      break
    }

    const serialized = serialize(next)
    trace.push(serialized)

    if (serialized === trace[trace.length - 2]) {
      stableAt = tick - 1
      break
    }

    graph = next
  }

  const carries = trace.map(line => tokenPattern(token).test(line))
  const carriedEveryStep = carries.every(Boolean)
  const changedThroughLimit = stableAt === undefined

  return {
    name: `${builderName} + ${stepperName}`,
    initialCycle,
    changedThroughLimit,
    stableAt,
    carriedEveryStep,
    error,
    trace,
  }
}

for (const [builderName, build, token] of builders) {
  for (const [stepperName, stepper] of steppers) {
    const result = run(builderName, build, token, stepperName, stepper)

    console.log(`\n== ${result.name} ==`)
    console.log(`cycle: ${result.initialCycle ? 'yes' : 'no'}`)
    console.log(`status: ${
      result.error
        ? `error: ${result.error}`
        : result.changedThroughLimit
          ? `changed through ${steps}`
          : `stable at ${result.stableAt}`
    }`)
    console.log(`carries token: ${result.carriedEveryStep ? 'yes' : 'no'}`)

    result.trace.forEach((line, index) => {
      console.log(`${String(index).padStart(2, '0')}: ${line}`)
    })
  }
}
