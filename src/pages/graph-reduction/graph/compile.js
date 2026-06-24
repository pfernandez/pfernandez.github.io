import { parse } from './parse.js'

const createIdentity = (name, state) => {
  const node = []
  node[0] = node
  node[1] = node
  state.legend.push([node, name])
  return node
}

const find = (scope, name) =>
  scope.find(binding => binding.name === name)?.node

const bind = (scope, name, state) => {
  const node = createIdentity(name, state)
  scope.unshift({ name, node })
  return node
}

const identity = (scope, name, state) =>
  find(scope, name) ?? bind(scope, name, state)

const wire = (form, scope, state) => {
  if (typeof form === 'string')
    return identity(scope, form, state)

  if (!Array.isArray(form) || !form.length) {
    const root = identity(scope, '()', state)
    state.root ??= root
    return root
  }

  if (isDefinition(form))
    return wireDefinition(form, scope, state)

  const node = form.map(item => wire(item, scope, state))
  if (node[0] === state.root)
    state.focus = node[1]
  return node
}

const isDefinition = form =>
  Array.isArray(form[0])
    && typeof form[0][0] === 'string'
    && form.length === 2

const wireDefinition = ([[name, ...args], body], scope, state) => {
  const node = identity(scope, name, state)
  const bodyScope = scope.slice()
  const signature = [
    node,
    ...args.map(arg => bind(bodyScope, arg, state))
  ]

  return [signature, wire(body, bodyScope, state)]
}

export const compile = source => {
  const state = { legend: [] }
  let graph = [], focus, error
  try {
    graph = wire(parse(source)[0], [], state)
    focus = state.focus ?? graph
    console.dir({ graph, focus, legend: state.legend }, { depth: null })
  } catch (e) {
    graph = []
    state.legend = []
    error = e
  }

  return { graph, focus, legend: state.legend, error }
}
