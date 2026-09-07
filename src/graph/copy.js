import { isFixed, isOpen } from './helpers.js'

/**
 * Copy a connected compiler artifact while preserving every shared identity.
 */
export const copyConnected = connected => {
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
    namedValues: set(connected.namedValues),
    sequences: set(connected.sequences),
    values: set(connected.values),
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

/**
 * Copy a definition body, replacing its parameters with argument identities.
 * Identities owned by an outer definition remain shared. Nested definitions
 * receive new local identities and ownership boundaries.
 */
export const copyBody = (definition, bindings, image) => {
  const {
    calls,
    definitions,
    fills,
    legend,
    namedValues,
    owner,
    sequences,
    values
  } = image
  const copies = new Map(bindings)

  const clone = (source, sourceOwner, targetOwner) => {
    if (copies.has(source)) return copies.get(source)
    if (isOpen(source) || isFixed(source)) return source
    if (owner.get(source) !== sourceOwner) return source

    const target = []
    copies.set(source, target)
    owner.set(target, targetOwner)

    const entry = legend.get(source)
    if (entry) legend.set(target, entry)

    const nested = definitions.get(source)
    if (nested) {
      const input = clone(nested.input, source, target)
      const body = clone(nested.body, source, target)
      target[0] = input
      target[1] = body
      definitions.set(target, {
        input,
        body,
        parameters: new Set([...nested.parameters]
          .map(parameter => copies.get(parameter) ?? parameter))
      })
    } else {
      target[0] = clone(source[0], sourceOwner, targetOwner)
      target[1] = clone(source[1], sourceOwner, targetOwner)
    }

    if (calls.has(source)) calls.add(target)
    if (fills.has(source)) fills.add(target)
    if (namedValues.has(source)) namedValues.add(target)
    if (sequences.has(source)) sequences.add(target)
    if (values.has(source)) values.add(target)
    return target
  }

  return clone(
    definitions.get(definition).body,
    definition,
    definition
  )
}
