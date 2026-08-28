/** Copy a connected compiler artifact while preserving every shared identity. */
export const copy = connected => {
  const copies = new Map()

  const graph = source => {
    if (!Array.isArray(source)) return source
    if (copies.has(source)) return copies.get(source)

    const target = []
    copies.set(source, target)
    source.forEach(node => target.push(graph(node)))
    return target
  }

  graph(connected.graph)
  connected.legend.forEach((_, identity) => graph(identity))

  const identity = source => copies.get(source) ?? source
  const set = source => new Set([...source].map(identity))
  const map = source => new Map([...source].map(([key, value]) =>
    [identity(key), value]))

  return {
    graph: identity(connected.graph),
    root: connected.root,
    calls: set(connected.calls),
    fills: set(connected.fills),
    inputs: set(connected.inputs),
    values: set(connected.values),
    capabilities: map(connected.capabilities),
    legend: map(connected.legend),
    owner: new Map([...connected.owner].map(([key, value]) =>
      [identity(key), identity(value)])),
    definitions: new Map([...connected.definitions]
      .map(([key, value]) => [identity(key), {
        input: identity(value.input),
        body: identity(value.body),
        parameters: set(value.parameters)
      }]))
  }
}
