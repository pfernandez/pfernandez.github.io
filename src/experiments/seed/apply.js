import { isFixed } from '../../graph/helpers.js'

const match = (pattern, value, bindings) => {
  const known = bindings.get(pattern)

  if (known && known !== value)
    throw new TypeError('Argument does not match transition input')
  if (known) return
  if (isFixed(pattern)) return bindings.set(pattern, value)
  if (isFixed(value))
    throw new TypeError('Argument does not match transition input')

  match(pattern[0], value[0], bindings)
  match(pattern[1], value[1], bindings)
}

const affected = (graph, bindings, seen = new Set()) => {
  if (bindings.has(graph)) return true
  if (isFixed(graph) || seen.has(graph)) return false

  seen.add(graph)
  return affected(graph[0], bindings, seen)
    || affected(graph[1], bindings, seen)
}

const materialize = (graph, bindings, construct, results = new Map()) => {
  if (bindings.has(graph)) return bindings.get(graph)
  if (!affected(graph, bindings)) return graph

  if (results.has(graph)) {
    const result = results.get(graph)
    if (!result) throw new TypeError('Recursive results require a tie')
    return result
  }

  results.set(graph, undefined)
  const result = construct(
    materialize(graph[0], bindings, construct, results),
    materialize(graph[1], bindings, construct, results)
  )
  results.set(graph, result)
  return result
}

const pair = (left, right) => Object.freeze([left, right])

/** Apply one identity-connected transition to an argument identity. */
export const apply = (transition, argument, construct = pair) => {
  const bindings = new Map()

  match(transition[0], argument, bindings)
  return materialize(transition[1], bindings, construct)
}
