import { decompose } from './decompose.js'
import { parse } from './parse.js'

// A scope is a visible pair, not a searchable subtree. Walking the scope list
// outward preserves lexical ancestry while `.find` exposes only local siblings.
const lookup = (symbol, scopes, i = scopes.length - 1) =>
  i >= 0 && (scopes[i].symbol === symbol
    ? scopes[i]
    : scopes[i].find(node => node?.symbol === symbol)
      ?? lookup(symbol, scopes, i - 1))

// Names annotate identities for linking and display; neither edge depends on
// the spelling once the graph has been linked.
const identify = (graph, symbol) => {
  graph['symbol'] = symbol

  return graph
}

const isSymbol = node => typeof node === 'string'
const isFixed = graph => graph[0] === graph && graph[1] === graph
const isNamed = graph => graph?.['symbol'] !== undefined
const isDefinition = graph => isNamed(graph) && !isFixed(graph)
// Before it has enough arguments, an application still points to its
// definition on the left. Completed applications contain arguments instead.
const isSuspended = graph => isDefinition(graph?.[0])
const atom = symbol => {
  const graph = []
  graph[0] = graph[1] = graph
  return Object.freeze(identify(graph, symbol))
}

// The linker uses four structural states; a suspension is an unfinished
// frontier, not a completed causal transition. If it remains unresolved,
// its supplied arguments are the causal prefix that actually occurred:
// atom                   [self, self]
// definition             [parameters, body]
// suspended application  [definition, supplied]
// completed application  [arguments, result]
const instantiate = (graph, bindings = [], states = []) => {
  // A later argument extends the supplied arguments' right spine.
  const append = (graph, node) => isNamed(graph)
    ? Object.freeze([graph, node])
    : Object.freeze([graph[0], append(graph[1], node)])

  // Parameter atoms capture whole argument branches. Parameter pairs recurse,
  // so authored nesting is part of a definition's signature.
  const match = (parameters, args) => {
    if (isFixed(parameters)) return [[parameters, args]]
    // A fixed argument cannot fill a parameter pair: the call is suspended.
    if (isFixed(args)) return

    const left = match(parameters[0], args[0])
    const right = match(parameters[1], args[1])
    return left && right && [...left, ...right]
  }

  let definition = graph[0]
  let args = graph[1]

  // Resume `[definition, supplied]` by appending the newly arrived argument.
  if (isSuspended(definition)) {
    args = append(definition[1], args)
    definition = definition[0]
    graph[0] = definition
    graph[1] = args
  }

  if (!isDefinition(definition) || !definition[1]) return Object.freeze(graph)

  const parameters = definition[0]
  const bound = match(parameters, args)

  if (!bound) return Object.freeze(graph)

  // A repeated definition with the same argument identities is the same
  // configuration. Reuse its unfinished graph to tie recurrence into a cycle.
  const state = states.find(([defined, previous]) =>
    defined === definition
      && previous.every(([, arg], i) => arg === bound[i][1]))

  if (state) return state[2]

  states.push([definition, bound, graph])
  // Inner bindings precede captured outer bindings and therefore shadow them.
  bindings = [...bound, ...bindings]
  const copies = []

  const contains = (graph, node, seen = []) => {
    if (graph === node) return true
    if (isFixed(graph) || seen.includes(graph)) return false

    seen.push(graph)
    return contains(graph[0], node, seen) || contains(graph[1], node, seen)
  }

  const captures = definition => bindings.some(([source]) =>
    !contains(definition[0], source) && contains(definition[1], source))

  // Copy the result topology while replacing parameter identities with the
  // identities of their arguments. `copies` preserves sharing and closes any
  // cycles encountered before the branch has finished being constructed.
  const copy = node => {
    const ref = bindings.find(([source]) => source === node)
    if (ref) return ref[1]

    const found = copies.find(([source]) => source === node)
    if (found) return found[1]
    // Named atoms and closed definitions already have stable identities.
    // A definition is copied only when doing so closes over an outer binding.
    if (isNamed(node) && (!isDefinition(node) || !captures(node))) return node

    // Applications found in a copied body are completed as they are copied.
    if (isDefinition(node[0])) {
      const argument = copy(node[1])
      const application = [
        copy(node[0]),
        isDefinition(node[1]?.[0]) && !isSuspended(argument)
          ? argument[1]
          : argument
      ]
      return instantiate(application, bindings, states)
    }

    const branch = []
    copies.push([node, branch])
    if (isDefinition(node)) identify(branch, node['symbol'])
    // A closure keeps its parameter identities and copies only the body in
    // which captured outer identities must be replaced.
    branch[0] = isDefinition(node) ? node[0] : copy(node[0])
    branch[1] = copy(node[1])
    return isDefinition(node)
      ? Object.freeze(branch)
      : instantiate(branch, bindings, states)
  }

  graph[0] = args
  graph[1] = copy(definition[1])
  return Object.freeze(graph)
}

// Build an ordinary expression without interpreting a fresh leftmost symbol
// as a definition. The pair itself becomes a local scope, so its right side can
// share an identity introduced on its left.
const branch = (expression, scopes) => {
  if (isSymbol(expression)) return lookup(expression, scopes) || atom(expression)

  const graph = []
  scopes = [...scopes, graph]
  const [left, right] = expression
  const ref = isSymbol(left) && lookup(left, scopes)

  graph[0] = isSymbol(left)
    ? ref || atom(left)
    : branch(left, scopes)
  graph[1] = isSymbol(right)
    ? lookup(right, scopes) || atom(right)
    : branch(right, scopes)

  if (ref || isSuspended(graph[0])) instantiate(graph)
  return Object.freeze(graph)
}

// A definition introduces every parameter identity before linking its body.
// Parameters share one lexical scope regardless of their nested pair shape.
const scope = (expression, scopes, graph) => {
  const define = expression => {
    if (isSymbol(expression)) {
      const graph = atom(expression)
      scopes.push(graph)
      return graph
    }

    const graph = []
    const [left, right] = expression
    graph[0] = define(left)
    graph[1] = define(right)
    return Object.freeze(graph)
  }

  const [parameters, body] = expression
  scopes = [...scopes]

  graph[0] = define(parameters)
  graph[1] = isSymbol(body)
    ? lookup(body, scopes) || atom(body)
    : fold(body, scopes).graph

  return Object.freeze(graph)
}

// `focus` and `call` are construction cursors. The final focus is exported,
// but neither cursor is stored as additional state in the graph itself.
const context = (graph, focus = graph, call = false) => ({ graph, focus, call })

// Fold a right-nested definition/application sequence from left to right. Each
// recursive pair is also the lexical frame visible to the following sibling.
const fold = (expression, scopes = []) => {
  const graph = []
  scopes = [...scopes, graph]
  const [left, right] = expression
  const ref = isSymbol(left) && lookup(left, scopes)
  let focus = graph
  let call = false

  if (isSymbol(left)) {
    if (ref) {
      // A visible leftmost identity makes this pair an application.
      graph[0] = ref
      graph[1] = branch(right, scopes)
      instantiate(graph)
      call = isDefinition(ref)
    } else {
      // A fresh leftmost identity names this pair and begins a definition.
      identify(graph, left)
      if (Array.isArray(right)) {
        const definition = scope(right, scopes, graph)
        return context(definition)
      }

      graph[0] = graph[1] = atom(right)
    }
  } else {
    const previous = fold(left, scopes)
    graph[0] = previous.graph
    const following = isSymbol(right)
      ? context(lookup(right, scopes) || atom(right))
      : fold(right, scopes)

    graph[1] = following.graph

    if (isSuspended(previous.focus)) {
      // The following sibling supplies the next argument to a partial call.
      instantiate(graph)
      call = true
    } else if (previous.call) {
      // Once a call has completed, following siblings apply to its result.
      focus = graph[1] = [previous.focus[1], graph[1]]
      if (isDefinition(focus[0])) instantiate(focus)
      else Object.freeze(focus)
      call = true
    } else if (isDefinition(previous.focus)) {
      // Definitions extend the visible library; observation begins later.
      focus = following.focus
      call = following.call
    } else {
      focus = graph
    }
  }

  return context(Object.freeze(graph), focus, call)
}

export const link = (source, imports = []) => {
  try {
    // Retain the source shape, lower it to pairs, then link identities in the
    // pair graph. Only the last construction frontier becomes the focus.
    const ast = parse(source)
    const pairs = decompose(ast)
    const imported = imports.map(atom)
    const scopes = [imported]
    const linked = isSymbol(pairs)
      ? context(lookup(pairs, scopes) || atom(pairs))
      : fold(pairs, scopes)
    const focus = isSuspended(linked.focus)
      ? linked.focus[1]
      : linked.focus

    return { ast, pairs, focus, graph: linked.graph }
  } catch (error) {
    const graph = []
    return { graph, focus: graph, error }
  }
}
