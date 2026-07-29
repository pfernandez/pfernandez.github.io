Error.stackTraceLimit = 1
import { parse } from './parse.js'
import { log } from './serialize.js'

const find = (symbol, stack, depth) =>
  depth >= 0 && stack[depth].find(entry => entry[0] === symbol)?.[1]

const _link = (tree, stack = []) =>
  (Array.isArray(tree) && tree.forEach((node, i) => {
    if (typeof node === 'string') {
      const depth = stack.length - 1
      const ref = find(node, stack, depth)

      if (ref) {
        tree[i] = ref
        stack[depth].push([node, ref])
      } else {
        const atom = []
        tree[i] = atom[0] = atom
        const entry = [node, atom]
        if (i === 0) stack.push([entry])
        else stack[depth].push(entry)
      }
    }

    // log({ node, tree, stack })

    _link(node, stack)
  }), tree)

export const link = source => {
  try {
    const tree = parse(source)
    const graph = _link(tree)
    log({ graph })
    return { graph, legend: [] }
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}

// {
//   graph: [
//     [
//       [ <ref *1> [ [Circular *1] ], <ref *2> [ [Circular *2] ] ],
//       <ref *2> [ [Circular *2] ]
//     ],
//     [
//       [
//         <ref *3> [ [Circular *3] ],
//         <ref *4> [ [Circular *4] ],
//         <ref *5> [ [Circular *5] ]
//       ],
//       <ref *4> [ [Circular *4] ]
//     ],
//     [
//       [
//         <ref *6> [ [Circular *6] ],
//         <ref *7> [ [Circular *7] ],
//         <ref *8> [ [Circular *8] ],
//         <ref *9> [ [Circular *9] ]
//       ],
//       [
//         [ <ref *7> [ [Circular *7] ], <ref *9> [ [Circular *9] ] ],
//         [ <ref *8> [ [Circular *8] ], <ref *9> [ [Circular *9] ] ]
//       ]
//     ]
//   ]
// }
