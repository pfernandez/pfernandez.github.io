Error.stackTraceLimit = 1
import { parse } from './parse.js'
import { log } from './serialize.js'

const fold = (tree, stack) =>
  Array.isArray(tree) && tree.forEach((node, i) => {
    if (typeof node === 'string') {
      const frame = stack[stack.length - 1]
      const ref = frame?.find(([symbol]) => symbol === node)?.[1]

      if (ref) {
        tree[i] = ref
      } else {
        const atom = []
        tree[i] = atom[0] = atom
        const entry = [node, atom]
        if (i === 0) stack.push([entry])
        else frame.push(entry)
      }
    }

    log({ node, tree, stack })

    fold(node, stack)
  })

export const link = source => {
  try {
    const tree = parse(source)
    const stack = []
    fold(tree, stack)
    return { graph: tree,
             legend: stack.flat().map(
               ([symbol, node]) => ({ node, symbol })) }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}

// Can we count cycles without allocation, i.e. with a binary counter?

// (((I x) x)
//  ((K x y) x)
//  ((S x y z) ((x z) (y z))))
// [
//   [
//     [ <ref *1> [ [Circular *1] ], <ref *2> [ [Circular *2] ] ],
//     <ref *2> [ [Circular *2] ]
//   ],
//   [
//     [
//       <ref *3> [ [Circular *3] ],
//       <ref *4> [ [Circular *4] ],
//       <ref *5> [ [Circular *5] ]
//     ],
//     <ref *4> [ [Circular *4] ]
//   ],
//   [
//     [
//       <ref *6> [ [Circular *6] ],
//       <ref *7> [ [Circular *7] ],
//       <ref *8> [ [Circular *8] ],
//       <ref *9> [ [Circular *9] ]
//     ],
//     [
//       [ <ref *7> [ [Circular *7] ], <ref *9> [ [Circular *9] ] ],
//       [ <ref *8> [ [Circular *8] ], <ref *9> [ [Circular *9] ] ]
//     ]
//   ]
// ]
