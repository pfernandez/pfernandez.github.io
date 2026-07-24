import { applyArgs } from './graph.js'
import { err } from './parse.js'

// This layer gives source spelling to graph identity. Names are used only
// while building the graph and later by the legend for display.

const isSymbol = form =>
  typeof form === 'string'

// A scope is a list of [name, node] pairs. Earlier scopes shadow later ones.
const binding = (name, bindings) =>
  bindings.find(([bindingName]) => bindingName === name)

const lookup = (name, scopes) => {
  for (const scope of scopes) {
    const found = binding(name, scope)
    if (found) return found[1]
  }
}

const remember = (scope, node, symbol) => {
  scope.legend.push({ node, symbol })
  return node
}

// One node per spelling in a compiled program, so atoms compare by identity.
const intern = (spelling, scope) => {
  if (!scope.atoms.has(spelling)) {
    const node = []
    node[0] = node
    node[1] = node
    scope.atoms.set(spelling, remember(scope, node, spelling))
  }
  return scope.atoms.get(spelling)
}

export const createScope = () => ({
  atoms: new Map(),
  legend: [],
  names: []
})

// A symbol means its binding if it has one, otherwise an atom. A list is its
// head applied to each following item in turn.
export const buildGraph = (form, scopes, scope) =>
  !Array.isArray(form)
    ? isSymbol(form) && lookup(form, scopes) || intern(form, scope)
    : form.length
      ? applyArgs(buildGraph(form[0], scopes, scope),
                  form.slice(1).map(item => buildGraph(item, scopes, scope)))
      : intern('()', scope)

// A top-level (name form) before the focus introduces a binding.
export const isBindingForm = form =>
  Array.isArray(form) && form.length === 2 && isSymbol(form[0])

// Walk the form's left edge collecting parameter names, innermost first. That
// is the order arguments arrive in a left-nested call. Return null if the form
// has no slots.
const parameters = (form, scope, names = []) =>
  Array.isArray(form) && form.length === 2 && isSymbol(form[1])
      && !binding(form[1], scope.names) && !names.includes(form[1])
    ? parameters(form[0], scope, [form[1], ...names])
    : names.length ? names : null

// Build a definition from its authored form. Each parameter becomes a slot:
// a stable node whose payload points back to the definition. The definition
// name is already bound, so self-reference becomes a cycle instead of an
// expansion.
const define = (
  [name, form],
  scope,
  parameterNames = parameters(form, scope)
) => {
  if (!parameterNames) err('Definitions need a body and at least one slot')

  const entry = binding(name, scope.names)
  const definition = remember(scope, entry?.[1] ?? [], name)
  const parameterBindings = parameterNames.map(name => {
    const slot = remember(scope, [], name)
    slot[0] = slot
    slot[1] = definition
    return [name, slot]
  })

  if (entry) entry[1] = definition
  else scope.names.push([name, definition])
  definition.push(...buildGraph(form, [parameterBindings, scope.names], scope))
}

const replace = (node, from, to, seen = new Set()) => {
  if (node === from) return to
  if (!Array.isArray(node) || seen.has(node)) return node

  seen.add(node)
  node.forEach((item, i) => { node[i] = replace(item, from, to, seen) })
  return node
}

// A binding without slots names raw graph structure. If it refers to itself,
// the placeholder is replaced with the finished graph after construction.
const bindValue = ([name, form], scope) => {
  const found = binding(name, scope.names)
  const entry = found ?? [name, []]
  const placeholder = entry[1]

  if (!found) scope.names.push(entry)
  const graph = buildGraph(form, [scope.names], scope)
  entry[1] = remember(scope, replace(graph, placeholder, graph), name)
}

export const bindForm = (
  form,
  scope,
  parameterNames = parameters(form[1], scope)
) =>
  parameterNames ? define(form, scope, parameterNames) : bindValue(form, scope)

// First classify each top-level form using only names already seen. Then
// predeclare definition nodes so helper bodies can refer to later helpers
// without changing how their own parameter slots are detected.
export const planBindings = forms => {
  const plannedScope = { names: [] }

  return forms.slice(0, -1).map(form => {
    if (!isBindingForm(form) || binding(form[0], plannedScope.names))
      return null

    const parameterNames = parameters(form[1], plannedScope)
    plannedScope.names.push([form[0], []])
    return { form, parameterNames }
  })
}

export const predeclareDefinitions = (scope, plans) => {
  for (const plan of plans)
    if (plan?.parameterNames)
      scope.names.push([plan.form[0], []])
}
