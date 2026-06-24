import { parse } from './parse.js'

const isDefinition = form =>
  typeof form[0] !== 'string'
    && typeof form[0][0] === 'string'

const compileSource = source => {
  const legend = []

  const identity = (scope, symbol) =>
    scope.find(([name]) => name === symbol)?.[1]

  const wire = (form, scope) => {
    if (typeof form === 'string')
      return identity(scope, form)

    if (!isDefinition(form))
      return form.map(item => wire(item, scope))

    const [[name, value], body] = form
    const binding = [name, value]
    const definitionScope = [binding, ...scope]

    if (typeof value === 'string')
      binding[1] = wire(value, scope)
    else
      [value[0], value[1]] = wire(value, definitionScope)

    legend.push([binding[1], name])
    return wire(body, definitionScope)
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
