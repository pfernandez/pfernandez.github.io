import { parse } from './parse.js'

const compileSource = source => {
  const legend = []

  const identity = (scope, symbol) =>
    scope.find(([name]) => name === symbol)?.[1]

  const wire = (form, scope) => {
    if (typeof form === 'string')
      return identity(scope, form)

    const [left, right] = form
    const named = typeof left === 'string' && !identity(scope, left)
    const pairScope = named ? [[left, form], ...scope] : scope
    form[0] = named ? form : wire(left, scope)
    form[1] = wire(right, pairScope)
    if (named) legend.push([form, left])
    return form
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
