const inspect = form => {
  if (!Array.isArray(form)
      || typeof form[0] !== 'string'
      || form.length !== 2
      || !Array.isArray(form[1])
      || form[1].length !== 2
      || !form[1].every(reference => typeof reference === 'string'))
    throw new TypeError('Expected (name (left right))')
  return form
}

/** Bind one new pair to itself or identities already visible. */
export const bind = (state, form) => {
  const [name, [left, right]] = inspect(form)
  const identities = new Map(state?.identities)

  if (identities.has(name))
    throw new ReferenceError(`Identity already exists: ${name}`)

  const graph = []
  identities.set(name, graph)
  const reference = name => {
    if (!identities.has(name))
      throw new ReferenceError(`Unknown identity: ${name}`)
    return identities.get(name)
  }

  graph[0] = reference(left)
  graph[1] = reference(right)
  Object.freeze(graph)

  return {
    identities,
    legend: new Map(state?.legend).set(graph, { name }),
    previous: state,
    root: graph
  }
}
