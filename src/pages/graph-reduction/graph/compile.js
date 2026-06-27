import { parse } from './parse.js'

const identityOf = (form, frames) =>
  frames
    .map(frame => frame.bindings.find(([name]) => name === form))
    .find(Boolean)?.[1]
const isRoot = form => Array.isArray(form) && form.length === 0
const isSymbol = form => typeof form === 'string'
const uniqueNames = entries =>
  entries.filter(([name], index) =>
    entries.findIndex(([other]) => other === name) === index)

const mentions = (form, names) =>
  isRoot(form)
    ? false
    : isSymbol(form)
    ? names.includes(form)
    : mentions(form[0], names) || mentions(form[1], names)

const leftSpine = (form, params = []) => {
  if (isRoot(form) || isRoot(form[0])) return

  return isSymbol(form[0])
    ? {
        name: form[0],
        params: uniqueNames(params.filter(([name]) => isSymbol(name)))
      }
    : leftSpine(form[0], [[form[0][1], form[0]], ...params])
}

const identityIntroducedBy = (form, frames) => {
  const identity = leftSpine(form)

  if (!identity) return
  if (identityOf(identity.name, frames)) return

  return identity
}

const isDefinition = form => {
  if (isSymbol(form) || isRoot(form) || isSymbol(form[0]) || isRoot(form[0]))
    return false

  const identity = leftSpine(form)
  if (!identity) return false

  const { params } = identity
  const names = params.map(([name]) => name)

  return names.length > 0 && mentions(form[1], names)
}

const isSequence = form =>
  !isSymbol(form) && !isRoot(form) && !isSymbol(form[0]) && isDefinition(form[0])

const graphify = ast => {
  const root = ast
  const legend = []
  const frames = []
  const atoms = new Map()
  const enter = pair =>
    frames.unshift({ pair, bindings: [] })
  const leave = () =>
    frames.shift()
  const push = (name, identity) =>
    frames[0].bindings.unshift([name, identity])
  const pushParams = params =>
    [...params]
      .reverse()
      .forEach(([param, node]) => push(param, node))
  const record = (name, identity) => {
    if (!legend.some(([node, symbol]) => node === identity && symbol === name))
      legend.push([identity, name])
  }
  const atom = name => {
    if (!atoms.has(name)) {
      const identity = []

      identity[0] = identity
      identity[1] = identity
      atoms.set(name, identity)
      record(name, identity)
    }

    return atoms.get(name)
  }

  const wire = form => {
    if (isRoot(form)) return root

    if (isSymbol(form)) {
      const identity = identityOf(form, frames)
      if (identity) return identity

      return atom(form)
    }

    enter(form)

    const [left, right] = form
    const identity = identityIntroducedBy(form, frames)

    if (identity) {
      push(identity.name, form)
      pushParams(identity.params)

      console.dir({ identity, frames, legend }, { depth: null })

      form[0] = wire(left)
      form[1] = wire(right)

      identity.params.forEach(([param, node]) => record(param, node))
      record(identity.name, form)
    } else {
      form[0] = wire(left)
      form[1] = wire(right)
    }

    const exported = identity && [identity.name, form]

    leave()

    if (exported && frames[0]) push(...exported)

    return form
  }

  const wireSequence = form => {
    form[0] = wire(form[0])
    form[1] = isSequence(form[1])
      ? wireSequence(form[1])
      : wire(form[1])

    form[1][0] = form

    return form[1]
  }

  const graph = isSequence(ast)
    ? (enter(ast), wireSequence(ast), leave(), ast)
    : wire(ast)
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
