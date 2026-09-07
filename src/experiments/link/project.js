/** Replace known identities, then pass each callable pair to its function. */
export const project = ({ graph, legend }) => {
  const visit = node => {
    const known = legend.get(node)
    if (known) return known.capability ?? known.name

    const pair = node.map(visit)
    return typeof pair[0] === 'function' ? pair[0](pair[1]) : pair
  }

  return visit(graph)
}
