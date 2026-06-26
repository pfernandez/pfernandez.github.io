import { parse } from './parse.js'

const identityOf = (form, scope) => scope.find(([name]) => name === form)?.[1]
const isSymbol = form => typeof form === 'string'
const isNewSymbol = (form, scope) => isSymbol(form) && !identityOf(form, scope)

const graphify = ast => {
  const legend = []

  const link = (form, scope = []) => {
    if (isSymbol(form)) return identityOf(form, scope)

    const [left, right] = form

    if (isNewSymbol(left, scope)) {
      form[0] = form
      form[1] = link(right, [[left, form], ...scope])
      legend.push([form, left])
    } else {
      form[0] = link(left, scope)
      form[1] = link(right, scope)
    }

    return form
  }

  const graph = link(ast)
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
