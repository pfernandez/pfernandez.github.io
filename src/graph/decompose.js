export const decompose = (tree, sequence = false) => {
  if (!Array.isArray(tree)) return tree
  if (!tree.length) return tree

  const [left, ...right] = tree
  if (!right.length) return decompose(left, sequence)

  const pair = [
    decompose(left),
    decompose(right.length === 1 ? right[0] : right, true)
  ]
  if (sequence)
    Object.defineProperty(pair, 'sequence', { value: true })
  return pair
}
