/**
 * The linker connects new structure only where the graph can legally continue.
 * We call that place the observable frontier: the end of the branch reached so
 * far by an observer.
 *
 * A frontier is not necessarily a leaf in the graph-theoretic sense. An atom
 * points to itself on both sides, so it has edges and forms a period-one orbit.
 * It is nevertheless the smallest frontier because following it reveals no new
 * state. A completed pair may also be a frontier when observation of that
 * branch ends there.
 *
 * A frontier is a completed boundary, not an empty socket. If `a` has already
 * occurred and a continuation arrives later, we do not change `a`. We preserve
 * its identity and create a new enclosing pair:
 *
 *     a -> (a continuation)
 *
 * The old graph remains stable and shared. The new pair remembers `a` on its
 * left and carries the continuation on its right, recording their causal order
 * without rewriting the past.
 *
 * A new connection is local and legal when it uses only:
 *
 * - the current frontier;
 * - a newly supplied identity; and
 * - identities visible in the frontier's lexical history.
 *
 * It may not reach into a sibling's private descendants, refer to a future
 * identity that has not arrived, or alter an identity that is already part of
 * the visible graph. Each branch inherits its enclosing history, while sibling
 * branches remain private except for identities deliberately shared through
 * that history.
 *
 * A suspended application follows the same rule. `(S a b)` is not a result
 * containing a hidden hole where `c` will later be inserted. It is the causal
 * prefix that actually occurred: `S`, then `a`, then `b`. If no further input
 * arrives, that is the branch's completed history. If `c` does arrive, new
 * structure connects that existing frontier to `c`; the earlier prefix is not
 * retroactively changed.
 *
 * This is also the basis for incremental linking. A seed observer could carry
 * its visible graph forward, accept a form or an existing identity, connect
 * what can be connected locally, and return a new observer rooted in the
 * extended graph. In that design linking is no longer necessarily a separate
 * whole-program phase. It is recursive graph construction governed by the same
 * rules of identity, visibility, and causality described above.
 *
 * Truly new identities still require fresh storage, but existing identities do
 * not need to be copied merely to extend the graph. New pairs can retain them
 * through structural sharing.
 */

import { decompose } from './decompose.js'
import { parse } from './parse.js'

// A lexical scope is a visible pair, not a searchable subtree. The outermost
// device scope maps authored names to function identities. Walking outward
// preserves lexical ancestry while `.find` exposes only local siblings.
const lookup = (symbol, stack, i = stack.length - 1) => {
  if (i < 0) return

  const scope = stack[i]

  // The outermost scope connects authored names to device identities.
  const imported = scope instanceof Map && scope.get(symbol)
  if (imported) return imported

  // A named pair is visible to its own body.
  if (scope.symbol === symbol) return scope

  // Only an earlier local sibling is visible from the current pair.
  const sibling = scope.find?.(node => node?.symbol === symbol)
  if (sibling) return sibling

  // If the name is not local, continue through the enclosing history.
  return lookup(symbol, stack, i - 1)
}

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
// Find the identity paired with a source identity.
const find = (node, entries) =>
  entries.find(([source]) => source === node)?.[1]
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

// Add a later argument to the right edge of the arguments already supplied.
const append = (graph, node) => isNamed(graph)
  ? Object.freeze([graph, node])
  : Object.freeze([graph[0], append(graph[1], node)])

// Match each parameter identity with the argument branch that fills it.
const match = (parameters, args) => {
  if (isFixed(parameters)) return [[parameters, args]]
  if (isFixed(args)) return

  const left = match(parameters[0], args[0])
  const right = match(parameters[1], args[1])
  return left && right && [...left, ...right]
}

// Look for an identity without becoming trapped in a cycle.
const contains = (graph, node, seen = []) => {
  if (graph === node) return true
  if (isFixed(graph) || seen.includes(graph)) return false

  seen.push(graph)
  return contains(graph[0], node, seen) || contains(graph[1], node, seen)
}

// A nested definition must be copied only when its body uses an outer binding.
const captures = (definition, bindings) => bindings.some(([source]) =>
  !contains(definition[0], source) && contains(definition[1], source))

// Copy a result while preserving identity, sharing, closures, and cycles.
const copy = (node, stack, bindings, states, copies = []) => {
  const ref = find(node, bindings)

  // A parameter becomes the identity of the argument supplied for it.
  if (ref) return ref

  const found = find(node, copies)

  // A branch already being copied keeps the same identity and closes a cycle.
  if (found) return found

  // Named atoms and definitions without captured bindings are already stable.
  if (isNamed(node) && (!isDefinition(node) || !captures(node, bindings)))
    return node

  const visible = isDefinition(node[0]) && (
    find(node[0], copies)
      ?? lookup(node[0]['symbol'], stack))
  const isVisible = Boolean(visible)
  const isNew = isDefinition(node[0]) && !isVisible

  // A visible definition on the left is being applied to the right side.
  if (isVisible) {
    const argument = copy(node[1], stack, bindings, states, copies)
    const application = [
      visible,
      isDefinition(node[1]?.[0]) && !isSuspended(argument)
        ? argument[1]
        : argument
    ]
    return instantiate(application, stack, bindings, states)
  }

  // An ordinary pair gets a fresh identity before either side is copied.
  const branch = []
  copies.push([node, branch])
  stack = [...stack, branch]
  if (isDefinition(node)) identify(branch, node['symbol'])

  // A closure keeps its own parameters and copies the body that captures the
  // outer binding. Every other pair copies both sides.
  branch[0] = isDefinition(node)
    ? node[0]
    : copy(node[0], stack, bindings, states, copies)
  branch[1] = copy(node[1], stack, bindings, states, copies)

  // A new definition on the left extends this local scope before observation
  // continues on the right. The enclosing pair is a sequence, not a call.
  if (isNew) return Object.freeze(branch)

  return isDefinition(node)
    ? Object.freeze(branch)
    : instantiate(branch, stack, bindings, states)
}

const instantiate = (graph, stack = [], bindings = [], states = []) => {
  let definition = graph[0]
  let args = graph[1]

  // A new argument resumes an application that previously stopped early.
  if (isSuspended(definition)) {
    args = append(definition[1], args)
    definition = definition[0]
    graph[0] = definition
    graph[1] = args
  }

  // A pair without a complete definition on the left cannot be applied.
  if (!isDefinition(definition) || !definition[1])
    return Object.freeze(graph)

  const bound = match(definition[0], args)

  // Too few arguments leave the application suspended at this frontier.
  if (!bound) return Object.freeze(graph)

  const state = states.find(([defined, previous]) =>
    defined === definition
      && previous.every(([, arg], i) => arg === bound[i][1]))

  // The same definition and argument identities are the same state. Reusing
  // its unfinished graph closes recurrence into a cycle.
  if (state) return state[2]

  states.push([definition, bound, graph])
  // Inner parameters precede outer bindings, so they shadow them.
  bindings = [...bound, ...bindings]
  // A definition remains visible inside its own body, allowing recurrence.
  stack = [...stack, definition]
  graph[0] = args
  graph[1] = copy(definition[1], stack, bindings, states)
  return Object.freeze(graph)
}

// A parameter pattern introduces fresh identities while preserving its shape.
// The definition body returns to the main walk, so nested definitions obey the
// same rules as every other definition.
const parameters = (expression, stack) => {
  if (isSymbol(expression)) {
    const graph = atom(expression)
    stack.push(graph)
    return graph
  }

  const graph = []
  graph[0] = parameters(expression[0], stack)
  graph[1] = parameters(expression[1], stack)
  return Object.freeze(graph)
}

// `focus` and `call` are construction cursors. The final focus is exported,
// but neither cursor is stored as additional state in the graph itself.
const context = (graph, focus = graph, call = false) => ({ graph, focus, call })

// Walk one pair at a time. `definitions` says whether a new leftmost name may
// name the pair or must remain an ordinary atom inside an expression.
const fold = (expression, stack = [], definitions = true) => {
  // A lone symbol reuses a visible identity or becomes a new atom.
  if (isSymbol(expression))
    return context(lookup(expression, stack) || atom(expression))

  const graph = []
  stack = [...stack, graph]
  const [left, right] = expression
  const ref = isSymbol(left) && lookup(left, stack)
  const isVisible = Boolean(ref)
  const isNew = isSymbol(left) && !isVisible

  // A visible name on the left applies that identity to the right side.
  if (isVisible) {
    graph[0] = ref
    graph[1] = fold(right, stack, false).graph
    instantiate(graph, stack)
    return context(Object.freeze(graph), graph, isDefinition(ref))
  }

  // Inside an expression, a new name remains an atom instead of naming a pair.
  if (!definitions) {
    graph[0] = fold(left, stack, false).graph
    graph[1] = fold(right, stack, false).graph
    if (isSuspended(graph[0])) instantiate(graph, stack)
    return context(Object.freeze(graph))
  }

  // A new name on the left names this pair and begins a definition.
  if (isNew) {
    identify(graph, left)
    const [pattern, body] = Array.isArray(right) ? right : [right, right]
    graph[0] = parameters(pattern, stack)
    graph[1] = fold(body, stack).graph
    return context(Object.freeze(graph))
  }

  // A pair on the left happens before the following sibling on the right.
  const previous = fold(left, stack)
  graph[0] = previous.graph
  const following = fold(right, stack)
  graph[1] = following.graph

  // A following sibling supplies the next argument to a suspended call.
  if (isSuspended(previous.focus)) {
    instantiate(graph, stack)
    return context(Object.freeze(graph), graph, true)
  }

  // A following sibling applies to the result of a completed call.
  if (previous.call) {
    const focus = graph[1] = [previous.focus[1], graph[1]]
    if (isDefinition(focus[0])) instantiate(focus, stack)
    else Object.freeze(focus)
    return context(Object.freeze(graph), focus, true)
  }

  // A definition extends the visible library; observation begins after it.
  if (isDefinition(previous.focus))
    return context(Object.freeze(graph), following.focus, following.call)

  // Otherwise this pair is the latest observable frontier.
  return context(Object.freeze(graph))
}

export const link = (source, imports = {}) => {
  try {
    // Retain the source shape, lower it to pairs, then link identities in the
    // pair graph. Only the last construction frontier becomes the focus.
    const ast = parse(source)
    const pairs = decompose(ast)
    const imported = new Map(Object.entries(imports)
      .map(([name, fn]) => [name, atom(fn)]))
    const stack = [imported]
    const linked = fold(pairs, stack)
    const focus = isSuspended(linked.focus)
      ? linked.focus[1]
      : linked.focus

    return { ast, pairs, focus, graph: linked.graph }
  } catch (error) {
    const graph = []
    return { graph, focus: graph, error }
  }
}
