/**
 * THE STEPPER: Remains 100% Pure.
 * Pattern: [Value, []] -> Value
 */
// const step = node => {
//   if (Array.isArray(node)) {
//     if (node.length === 0) return node
//     const [left, right] = node

//     if (Array.isArray(right) && right.length === 0) {
//       return step(left)
//     }
//     return [step(left), step(right)]
//   }
//   return node
// }


/**
 * THE DYCK STEPPER: Strict Left-to-Right reduction.
 * Returns [nextState, movement]
 */
// const stepDyck = node => {
//   // Base case: Holes are the "Ground"
//   if (Array.isArray(node) && node.length === 0) return [node, null]

//   if (Array.isArray(node) && node.length === 2) {
//     const [left, right] = node

//     // 1. THE DOWN MOVE: Annihilation [val, []] -> val
//     // This is the "Down" stroke of the Dyck path.
//     if (Array.isArray(right) && right.length === 0) {
//       return [stepDyck(left)[0], 'Down']
//     }

//     // 2. THE UP MOVE: Priority Left
//     // We attempt to "Up-stroke" into the left branch first.
//     const [nextLeft, move] = stepDyck(left)

//     if (move !== null) {
//       // If the left side moved, we stay on this peak.
//       return [[nextLeft, right], 'Up']
//     }

//     // 3. THE TRANSITION: Only step Right if Left is stable.
//     const [nextRight, nextMove] = stepDyck(right)
//     return [[left, nextRight], nextMove]
//   }

//   return [node, null]
// }

// /**
//  * THE PATH MONITOR: Logs the journey.
//  */
// const tracePath = motif => {
//   let state = motif
//   let path = ''
//   let i = 0

//   while (true) {
//     const [next, move] = stepDyck(state)

//     if (move === null) break

//     path += move === 'Up' ? ' /' : ' \\'
//     state = next

//     console.log(`Step ${++i}: ${path.padEnd(20)} | ${JSON.stringify(state)}`)
//   }

//   console.log('\nStability Reached.')
//   return state
// }

// // --- RUNNING THE DYCK PROTOTYPE ---

// // Using your notation: ((0 2)(1 2))
// // a=0, b=1, c=2
// // 'c' is shared and delayed.
// const sharedC = [['c', []], []]
// const motif = [
//   [['a', []], sharedC], // The first peak
//   [['b', []], sharedC]  // The second peak
// ]

// tracePath(motif)

// /**
//  * 1. THE STEPPER (The "Virtual Pointer")
//  * Purely structural. No booleans or tags.
//  * Only steps Right if the Left is physically stable (unchanged).
//  */
// const step = node => {
//   if (!Array.isArray(node) || node.length === 0) return node
//   const [left, right] = node

//   // The Annihilation Rule: [val, []] -> val
//   if (Array.isArray(right) && right.length === 0) {
//     return step(left)
//   }

//   // Left-Priority Focus
//   const nextLeft = step(left)
//   if (nextLeft !== left) return [nextLeft, right]

//   // Shift to Right only when Left is exhausted
//   const nextRight = step(right)
//   if (nextRight !== right) return [left, nextRight]

//   return node
// }

// /**
//  * 2. THE CONVERGER (The "Energy")
//  * Recursively exhausts the potential of the graph.
//  */
// const converge = (node, depth = 0) => {
//   console.log(`Step ${depth}:`.padEnd(8), JSON.stringify(node))
//   const next = step(node)
//   if (next === node) return node // Equilibrium
//   return converge(next, depth + 1)
// }

// /**
//  * 3. THE COMPILER (The "Load")
//  * Converts S-notation ((0 2)(1 2)) into a shared, valid DAG.
//  */
// const compile = (motif, args) => {
//   const registry = new Map()

//   const build = node => {
//     // Handle Slots: Shared references with "annihilation" delay
//     if (typeof node === 'number') {
//       if (!registry.has(node)) {
//         let val = args[node]
//         for (let i = 0; i < node; i++) val = [val, []] // Depth = Clock
//         registry.set(node, val)
//       }
//       return registry.get(node)
//     }

//     // Handle Pairs
//     if (Array.isArray(node)) {
//       const pair = [build(node[0]), build(node[1])]
//       if (hasCycle(pair)) throw new Error('Causality Violation')
//       return pair
//     }
//     return node
//   }

//   return build(motif)
// }

// // Causality Guard
// const hasCycle = (node, seen = new Set()) => {
//   if (seen.has(node)) return true
//   if (Array.isArray(node) && node.length > 0) {
//     seen.add(node)
//     return node.some(child => hasCycle(child, new Set(seen)))
//   }
//   return false
// }

// // --- EXECUTION ---

// try {
//   const myNotation = [[0, 2], [1, 2]] // ((0 2)(1 2))
//   const myArgs = ['a', 'b', 'c']

//   console.log('--- Compiling Graph ---')
//   const program = compile(myNotation, myArgs)

//   console.log('--- Commencing Sequential Evaluation ---')
//   const final = converge(program)

//   console.log('\nFinal Stable State:', JSON.stringify(final))
// } catch (e) {
//   console.error(e.message)
// }


/**
 * THE HONEST STEPPER
 * A pure structural reducer.
 * 1. Collapses [val, []] patterns.
 * 2. Focuses Left.
 * 3. Shifts Right ONLY if Left is stable (unchanged).
 */
const step = node => {
  if (!Array.isArray(node) || node.length === 0) return node
  const [left, right] = node

  // Rule 1: Annihilation [val, []] -> val
  if (Array.isArray(right) && right.length === 0) return step(left)

  // Rule 2: Focus Left
  const nextLeft = step(left)
  if (nextLeft !== left) return [nextLeft, right]

  // Rule 3: Shift Right (The "Sequential Observer")
  const nextRight = step(right)
  if (nextRight !== right) return [left, nextRight]

  return node
}

/**
 * THE COMPILER
 * Builds a shared Directed Acyclic Graph (DAG).
 */
const compile = (motif, args) => {
  const registry = new Map()
  const hasCycle = (n, s = new Set()) => {
    if (s.has(n)) return true
    if (Array.isArray(n) && n.length > 0) {
      s.add(n)
      return n.some(c => hasCycle(c, new Set(s)))
    }
    return false
  }

  const build = node => {
    if (typeof node === 'number') {
      if (!registry.has(node)) {
        let val = args[node]
        // The delay layers for slot-ordering
        for (let i = 0; i < node; i++) val = [val, []]
        registry.set(node, val)
      }
      return registry.get(node)
    }
    if (Array.isArray(node)) {
      const pair = [build(node[0]), build(node[1])]
      if (hasCycle(pair)) throw new Error('Causality Violation')
      return pair
    }
    return node
  }

  return build(motif)
}

/**
 * THE CONVERGER
 * The recursive engine that drives the reduction.
 */
const converge = (node, depth = 0) => {
  console.log(`Step ${depth}:`.padEnd(8), JSON.stringify(node))
  const next = step(node)
  if (next === node) return node
  return converge(next, depth + 1)
}

// --- RUN ---
const myNotation = [[0, 2], [1, 2]]
const myArgs = ['a', 'b', 'c']

console.log('--- Evaluation Started ---')
const program = compile(myNotation, myArgs)
const result = converge(program)
console.log('\nFinal:', JSON.stringify(result))
