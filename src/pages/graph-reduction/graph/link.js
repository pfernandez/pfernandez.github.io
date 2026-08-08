Error.stackTraceLimit = 1
import { parse } from './parse.js'
import { log } from './serialize.js'

const find = (symbol, stack, i = stack.length - 1) =>
  i >= 0 && (stack[i].find(node => node?.symbol === symbol)
    ?? find(symbol, stack, i - 1))

const fold = (tree, stack = []) => {
  if (!Array.isArray(tree)) return
  stack = [...stack, tree]

  tree.forEach((node, i) => {
    if (typeof node === 'string') {
      const ref = find(node, stack)

      if (i === 0) {
        tree[i] = ref || tree
        tree['symbol'] = node
      } else if (ref) {
        tree[i] = ref
      } else {
        const atom = []
        tree[i] = atom[0] = atom[1] = atom
        atom['symbol'] = node
      }
    } else {
      fold(node, stack)
      if (i === 1 && tree['symbol']) stack = [...stack, node]
    }
  })

  log({ tree, stack })
}

export const link = source => {
  try {
    const tree = parse(source)
    fold(tree)
    return { graph: tree }
  } catch (error) {
    return { graph: [], error }
  }
}

// Can we count cycles without allocation, i.e. with a binary counter?
