import { parse } from './parse.js'

const isRoot = form => Array.isArray(form) && form.length === 0

const isSymbol = form => typeof form === 'string'

const uniqueNames = entries =>
  entries.filter(([name], index) =>
    entries.findIndex(([other]) => other === name) === index)

const containsSymbols = (form, names) =>
  isRoot(form) ? false
    : isSymbol(form) ? names.includes(form)
      : containsSymbols(form[0], names) || containsSymbols(form[1], names)

const leftSpine = (form, params = []) => {
  if (isRoot(form) || isRoot(form[0])) return

  return isSymbol(form[0])
    ? { name: form[0],
        params: uniqueNames(params.filter(([name]) => isSymbol(name))) }
    : leftSpine(form[0], [[form[0][1], form[0]], ...params])
}

const callSpine = (form, args = []) => {
  if (isRoot(form) || isRoot(form[0])) return

  return isSymbol(form[0])
    ? { name: form[0], args: [[form[1], form], ...args] }
    : callSpine(form[0], [[form[1], form], ...args])
}

const binding = (name, scopes) =>
  scopes
    .map(scope => scope.find(([symbol]) => symbol === name))
    .find(Boolean)

const identityOf = (name, scopes) =>
  binding(name, scopes)?.[1]

const isDefinition = form => {
  if (isSymbol(form) || isRoot(form) || isSymbol(form[0]) || isRoot(form[0]))
    return false

  const identity = leftSpine(form)
  if (!identity) return false

  const names = identity.params.map(([name]) => name)
  return names.length > 0 && containsSymbols(form[1], names)
}

const isSequence = form =>
  !isSymbol(form) && !isRoot(form)
    && !isSymbol(form[0]) && isDefinition(form[0])

const graphify = graph => {
  const legend = []
  const scopes = []
  const definitions = new Map()

  const enter = () => scopes.unshift([])
  const leave = () => scopes.shift()
  const push = (name, identity) => scopes[0].unshift([name, identity])
  const pushParams = params =>
    [...params].reverse().forEach(([name, identity]) => push(name, identity))

  const record = (name, identity) =>
    !legend.some(([node, symbol]) => node === identity && symbol === name)
      && legend.push([identity, name])

  const self = identity => {
    identity[0] = identity
    identity[1] = identity
    return identity
  }

  const occurrence = identity => {
    const node = []
    node[0] = identity
    node[1] = node
    return node
  }

  const symbol = (name, parent) => {
    const identity = identityOf(name, scopes)
    if (identity) return identity

    const node = parent ?? self([])
    record(name, node)
    return node
  }

  const appliedBody = (application, form) => {
    if (!application) return

    const definition = definitions.get(application.name)
    if (!definition) return
    if (application.args.length < definition.params.length) return

    const index = definition.params.findIndex(([, node]) =>
      node === definition.body)

    return index === -1 ? undefined : application.args[index][1][1] ?? form
  }

  const wire = (form, parent) => {
    if (isRoot(form)) return graph
    if (isSymbol(form)) return symbol(form, parent)

    enter()

    const [left, right] = form
    const candidate = leftSpine(form)
    const identity =
      candidate && !identityOf(candidate.name, scopes) && candidate
    const application = identity ? undefined : callSpine(form)
    const knownCall = application && definitions.has(application.name)

    if (identity) {
      push(identity.name, form)
      pushParams(identity.params)
    }

    const callIdentity =
      knownCall && isSymbol(left) && identityOf(left, scopes)

    form[0] = callIdentity ? occurrence(callIdentity) : wire(left, form)
    form[1] = wire(right, form)

    if (identity) {
      identity.body = form[1]
      definitions.set(identity.name, identity)
      identity.params.forEach(([name, node]) => record(name, node))
      record(identity.name, form)
    }

    const exported = identity && [identity.name, form]

    leave()

    if (exported && scopes[0]) push(...exported)

    return appliedBody(application, form) ?? form
  }

  const wireSequence = form => {
    form[0] = wire(form[0], form)
    form[1] = isSequence(form[1]) ? wireSequence(form[1]) : wire(form[1], form)

    return form[1]
  }

  isSequence(graph)
    ? (enter(), wireSequence(graph), leave())
    : wire(graph)

  console.dir({ graph, legend }, { depth: null })

  return { graph, legend }
}

export const compile = source => {
  try {
    const ast = parse(source)[0]
    console.dir({ ast }, { depth: null })
    return graphify(ast)
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
