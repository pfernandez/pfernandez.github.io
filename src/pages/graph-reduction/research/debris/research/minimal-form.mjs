import { pathToFileURL } from 'url'
import { serialize } from '../serialize.mjs'

const isPair = node =>
  Array.isArray(node) && node.length !== 0

const isEmpty = node =>
  Array.isArray(node) && node.length === 0

// Observation selects existing material. It never returns a new pair.
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

const trace = (name, focus, limit = 8) => {
  const seen = new Map()

  console.log(`\n${name}`)

  for (let step = 0; step <= limit; step++) {
    console.log(`${step}: ${serialize(focus)}`)

    if (seen.has(focus)) {
      console.log(`cycle: ${seen.get(focus)} -> ${step}`)
      return
    }

    seen.set(focus, step)

    const next = observe(focus)
    if (next === focus) return

    focus = next
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Vacuum: one self-referential pair is stable, but has no distinction.

  let V = []
  V[0] = V
  V[1] = V

  trace('V', V)


  // Clock: three pair nodes are enough for pair-only visible recurrence.

  let C = []
  C[0] = C
  C[1] = []

  C[1][0] = C[1]
  C[1][1] = []

  C[1][1][0] = C
  C[1][1][1] = C

  trace('C', C)


  // I: (() x) -> x

  let I = []
  I[0] = []
  I[1] = 'x'

  trace('I', I)


  // K: ((() x) y) -> x

  let K = []
  K[0] = []
  K[1] = 'y'

  K[0][0] = []
  K[0][1] = 'x'

  trace('K', K)


  // S: (() ((x z) (y z))) -> ((x z) (y z))

//   let S = []
//   S[0] = []
//   S[1] = []

//   S[1][0] = []
//   S[1][1] = []

//   S[1][0][0] = 'x'
//   S[1][0][1] = 'z'

//   S[1][1][0] = 'y'
//   S[1][1][1] = S[1][0][1]

//   trace('S', S)
  let S = []

  S[0] = []
  S[1] = 'z'

  S[0][0] = []
  S[0][1] = 'y'

  S[0][0][0] = []
  S[0][0][1] = 'x'

  S[0][0][0][0] = S[0][0][0]
  S[0][0][0][1] = []

  S[0][0][0][1][0] = []
  S[0][0][0][1][1] = []

  S[0][0][0][1][0][0] = S[0][0][1]  // x
  S[0][0][0][1][0][1] = S[1]        // z

  S[0][0][0][1][1][0] = S[0][1]     // y
  S[0][0][0][1][1][1] = S[1]        // z

  trace('S', S)

  // Z: a conserved two-state orbit carrying x.

  let Z = []
  Z[0] = 'x'
  Z[1] = []

  Z[1][0] = []
  Z[1][1] = []

  Z[1][1][0] = []
  Z[1][1][1] = Z

  trace('Z', Z)
}
