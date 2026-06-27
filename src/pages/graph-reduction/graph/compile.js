import { parse } from './parse.js'

const identityOf = (form, scope) => scope.find(([name]) => name === form)?.[1]
const isSymbol = form => typeof form === 'string'
const isNewSymbol = (form, scope) => isSymbol(form) && !identityOf(form, scope)

const definition = (form, scope) => {
  if (isSymbol(form[0])) return

  const leftmostSymbol = (form, nodes = []) =>
    isSymbol(form[0])
      ? { name: form[0], nodes }
      : leftmostSymbol(form[0], [form[0], ...nodes])

  const containsSymbols = (form, symbols) =>
    isSymbol(form)
      ? symbols.includes(form)
      : containsSymbols(form[0], symbols) || containsSymbols(form[1], symbols)

  const candidate = leftmostSymbol(form)
  const params = candidate.nodes.map(node => node[1]).filter(isSymbol)

  if (isNewSymbol(candidate.name, scope) && containsSymbols(form[1], params))
    return candidate
}

const graphify = ast => {
  const legend = []
  const link = (form, scope = []) => {
    if (isSymbol(form)) return identityOf(form, scope) ?? form

    const [left, right] = form
    const found = definition(form, scope)

    if (found) {
      const { name, nodes } = found
      const params = nodes
        .map(node => [node[1], node])
        .filter(([param]) => isSymbol(param))
      const localScope = [...params, [name, form], ...scope]

      console.dir({ found, localScope, scope, legend }, { depth: null })

      form[0] = link(left, localScope)
      form[1] = link(right, localScope)

      legend.push(...params.map(([param, node]) => [node, param]), [form, name])
      scope.unshift([name, form])
    } else if (isNewSymbol(left, scope)) {
      const binding = [left, form]
      const bodyScope = [binding, ...scope]

      form[0] = form

      if (isNewSymbol(right, bodyScope)) {
        form[1] = form

        scope.unshift([right, form])
      } else {
        form[1] = link(right, bodyScope)
      }

      legend.push([form, left])
      scope.unshift(binding)
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
