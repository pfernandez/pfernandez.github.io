import { parse } from './parse.js'

const isDefinition = form =>
  typeof form[0] !== 'string'
    && typeof form[0][0] === 'string'

const compileSource = source => {
  const legend = []

  const createIdentity = symbol => {
    const node = []
    node[0] = node
    node[1] = node
    legend.push([node, symbol])
    return node
  }

  const identity = (scope, symbol) =>
    scope.find(([name]) => name === symbol)?.[1]
      ?? legend.find(([, name]) => name === symbol)?.[0]
      ?? createIdentity(symbol)

  const wire = (form, scope) =>
    typeof form === 'string' ? identity(scope, form)
      : !form.length ? identity(scope, '()')
          : isDefinition(form[0]) ? wireDefinition(form, scope)
            : form.map(item => wire(item, scope))

  const wireDefinition = (form, scope) => {
    const [[[name, ...params], body], [, ...argForms]] = form
    const node = []
    const definitionScope = [[name, node], ...scope]
    const args = argForms.map(arg => wire(arg, definitionScope))
    const bodyScope = [...params.map((param, i) => [param, args[i]]),
                       ...definitionScope]
    node[0] = node
    node[1] = wire(body, bodyScope)
    return [node, ...args]
  }

  const graph = wire(parse(source)[0], [])
  console.dir({ graph, legend }, { depth: null })
  return { graph, legend }
}

export const compile = source => {
  try {
    return compileSource(source)
  } catch (error) {
    return { graph: [], legend: [], error }
  }
}
