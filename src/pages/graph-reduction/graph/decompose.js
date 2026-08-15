export const decompose = tree => {
  if (!Array.isArray(tree) || !tree.length) return tree

  const [left, ...right] = tree
  if (!right.length) return decompose(left)

  return [
    decompose(left),
    decompose(right.length === 1 ? right[0] : right)
  ]
}
