export const decompose = tree => {
  if (!Array.isArray(tree) || !tree.length) return tree

  const [left, ...right] = tree

  return right.length
    ? [decompose(left), decompose(right.length === 1 ? right[0] : right)]
    : decompose(left)
}
