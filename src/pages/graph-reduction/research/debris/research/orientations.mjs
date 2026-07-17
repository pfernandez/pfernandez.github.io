import { steppers } from './observer-variants.mjs'
import { serialize } from '../serialize.mjs'

const steps = Number(process.argv[2] ?? 6)
const showTraces = process.argv.includes('--trace')

// Still unexplored: non-root back-edges, multiple back-edges, mutual cycles,
// and recursive motifs where the payload moves through more than one delayed slot.

const root = build => {
  const graph = []
  build(graph)
  return graph
}

const motifs = [
  [
    'payload-left delay-right',
    'stream',
    '(x (() @))',
    () => root(graph => {
      graph[0] = 'x'
      graph[1] = [[], graph]
    }),
  ],
  [
    'delay-left payload-right',
    'Z',
    '((() @) x)',
    () => root(graph => {
      graph[0] = [[], graph]
      graph[1] = 'x'
    }),
  ],
  [
    'payload-left right-delay',
    'right-delayed stream',
    '(x (@ ()))',
    () => root(graph => {
      graph[0] = 'x'
      graph[1] = [graph, []]
    }),
  ],
  [
    'right-delay payload-right',
    'right-delayed Z',
    '((@ ()) x)',
    () => root(graph => {
      graph[0] = [graph, []]
      graph[1] = 'x'
    }),
  ],
  [
    'payload-left root-right',
    'raw right cycle',
    '(x @)',
    () => root(graph => {
      graph[0] = 'x'
      graph[1] = graph
    }),
  ],
  [
    'root-left payload-right',
    'raw left cycle',
    '(@ x)',
    () => root(graph => {
      graph[0] = graph
      graph[1] = 'x'
    }),
  ],
  [
    'delay-left root-right',
    'bare delayed root',
    '(() @)',
    () => root(graph => {
      graph[0] = []
      graph[1] = graph
    }),
  ],
  [
    'root-left delay-right',
    'guarded raw root',
    '(@ (() x))',
    () => root(graph => {
      graph[0] = graph
      graph[1] = [[], 'x']
    }),
  ],
]

const trace = (graph, stepper) => {
  let current = graph
  const lines = [serialize(current)]

  for (let index = 0; index < steps; index += 1) {
    let next

    try {
      next = stepper(current)
    } catch (error) {
      return { lines, status: `error: ${error.message}` }
    }

    const line = serialize(next)
    lines.push(line)

    if (line === lines.at(-2)) return { lines, status: `stable at ${index}` }

    current = next
  }

  return { lines, status: `changed through ${steps}` }
}

const classify = lines => {
  const last = lines.at(-1)

  if (!/\bx\b/.test(last)) return 'loses x'
  if (/^\(x \(x \(x/.test(last)) return 'grows right'
  if (/^\(\(\(\(/.test(last) && /\) x\) x\) x/.test(last)) return 'grows left'
  if (lines.length > 1 && last === lines.at(-2)) return 'stable'

  return 'other'
}

for (const [orientation, name, source, build] of motifs) {
  console.log(`\n== ${orientation} ==`)
  console.log(`name: ${name}`)
  console.log(`form: ${source}`)

  for (const [stepperName, stepper] of steppers) {
    const result = trace(build(), stepper)
    console.log(`${stepperName}: ${result.status}, ${classify(result.lines)}`)

    if (showTraces) {
      result.lines.forEach((line, index) => {
        console.log(`${String(index).padStart(2, '0')}: ${line}`)
      })
    }
  }
}
