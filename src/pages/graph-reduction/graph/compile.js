import { parse } from './parse.js'

const createIdentity = (name, legend) => {
  const node = []
  node[0] = node
  node[1] = node
  legend.push([node, name])
  return node
}

const find = (scope, name) =>
  scope.find(binding => binding.name === name)?.node

const bind = (scope, name, legend) => {
  const node = createIdentity(name, legend)
  scope.unshift({ name, node })
  return node
}

const identity = (scope, name, legend) =>
  find(scope, name) ?? bind(scope, name, legend)

const wire = (form, scope, legend) => {
  if (typeof form === 'string')
    return identity(scope, form, legend)

  if (!Array.isArray(form) || !form.length)
    return identity(scope, '()', legend)

  if (isDefinition(form))
    return wireDefinition(form, scope, legend)

  return form.map(item => wire(item, scope, legend))
}

const isDefinition = form =>
  Array.isArray(form[0])
    && typeof form[0][0] === 'string'
    && form.length === 2

const wireDefinition = ([[name, ...args], body], scope, legend) => {
  const node = identity(scope, name, legend)
  const bodyScope = scope.slice()
  const signature = [
    node,
    ...args.map(arg => bind(bodyScope, arg, legend))
  ]

  return [signature, wire(body, bodyScope, legend)]
}

export const compile = source => {
  let graph = [], legend = [], error
  try {
    graph = wire(parse(source)[0], [], legend)
    console.dir({ graph, legend }, { depth: null })
  } catch (e) {
    graph = []
    legend = []
    error = e
  }

  return { graph, legend, error }
}
