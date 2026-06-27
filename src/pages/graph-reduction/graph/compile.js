import { parse } from './parse.js'

const identityOf = (form, stack) => stack.find(([name]) => name === form)?.[1]
const isSymbol = form => typeof form === 'string'
const uniqueNames = entries =>
  entries.filter(([name], index) =>
    entries.findIndex(([other]) => other === name) === index)

const leftSpine = (form, params = []) =>
  isSymbol(form[0])
    ? {
      name: form[0],
      params: uniqueNames(params.filter(([name]) => isSymbol(name)))
    }
    : leftSpine(form[0], [[form[0][1], form[0]], ...params])

const identityIntroducedBy = (form, stack) => {
  const identity = leftSpine(form)

  if (identityOf(identity.name, stack)) return

  return identity
}

const graphify = ast => {
  const legend = []
  const push = (stack, name, identity) => {
    legend.push([identity, name])
    stack.unshift([name, identity])
  }

  const wire = (form, stack = []) => {
    if (isSymbol(form)) return identityOf(form, stack) ?? form

    const [left, right] = form
    const identity = identityIntroducedBy(form, stack)

    if (identity) {
      const localStack = [...identity.params, [identity.name, form], ...stack]

      console.dir({ identity, localStack, stack, legend }, { depth: null })

      form[0] = wire(left, localStack)
      form[1] = wire(right, localStack)

      identity.params.forEach(([param, node]) => legend.push([node, param]))
      push(stack, identity.name, form)
    } else {
      form[0] = wire(left, stack)
      form[1] = wire(right, stack)
    }

    return form
  }

  const graph = wire(ast)
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
