/**
 * The linker turns authored sequences into one static, right-nested pair graph.
 * Its unique Root closes over every causally connected observer and event. A
 * focus is only one observer's position inside that Root; many observers may
 * begin at many foci without changing the graph.
 *
 * A fixed atom is the smallest focus:
 *
 *     I = (I I)
 *
 * Exchanging its edges changes nothing. Orientation first becomes meaningful
 * when a focus relates distinct identities. We choose the left edge for the
 * current or earlier event and the right edge for the following focus. The
 * opposite convention would express the same capacity in reverse order:
 *
 *     I
 *     (I J)
 *     (I (J K))
 *     (I (J (K L)))
 *
 * A focus may be anonymous or named by one of its authored states. A right-only
 * observer walks the nested suffixes without changing the graph:
 *
 *     (I (J K)) -> (J K) -> K -> K -> ...
 *
 * Keep three orders distinct:
 *
 * - causal order: I, then J, then K;
 * - observer order: each focus followed by its right focus;
 * - linker order: I -> (I J) -> (I (J K)).
 *
 * Linker order describes successive static graph descriptions, not runtime
 * events. Extending `(I J)` as `((I J) K)` would create a different,
 * left-nested causal graph. A right-nested extension instead rebuilds the
 * enclosing right spine as `(I (J K))`. An earlier version may remain allocated
 * outside the new Root, while existing event identities can still be shared.
 *
 * Names identify pairs; they are not runtime cells or extra causal events. The
 * observer knows only the resulting identities. These are the intended naming
 * rules; the current fold does not yet implement every case:
 *
 * - In `(F input output)`, a fresh `F` names the definition pair
 *   `(input output)`. The tag is removed from the pair's two states.
 * - In `(F argument)`, a visible `F` identifies the definition being applied
 *   and is removed. The application is the anonymous pair `(argument result)`.
 * - A compound state may name its own pair: `(a b c)` can express
 *   `a = (b c)`. It remains an argument or body once its enclosing context has
 *   already identified that role; three siblings do not make it a definition.
 * - A fresh name followed by one state has no inner pair to name, so it remains
 *   as the pair's left self-reference: `(a b)` means `a = (a b)`.
 * - A fresh name with no following state closes into the fixed pair
 *   `a = (a a)`. Thus applying `I = (x x)` to fresh `a` produces one identity,
 *   not an atom plus an anonymous duplicate pair.
 *
 * These are one rule at different sequence lengths:
 *
 *     a                  means a = (a a)
 *     (a b)              means a = (a b)
 *     (a b c)            means a = (b c)
 *     (a b c d)          means a = (b (c d))
 *
 * A lone state may begin as the fixed construction frontier `a = (a a)`. If
 * `b` follows while the static graph is being linked, `b = (b b)` occupies its
 * right edge and the completed frontier is `a = (a b)`. This is the normal
 * continuation rule, not runtime mutation. Once Root is linked and frozen,
 * both identities and edges remain stable.
 *
 * A name may therefore be a removable tag or an identity occupying one of the
 * pair's states. Removing a tag must preserve the remaining authored sequence;
 * retaining a name as a self-reference changes the graph and must be deliberate.
 * Root follows the same rule as every other pair. An optional `(root (...))`
 * tag names the outermost program pair but adds no wrapper, input, or self-edge.
 * Omitting the tag produces the same graph edges. It must not be mistaken for a
 * unary function merely because `root` is new.
 *
 * Parameter patterns obey the same rule. In `(x y z)`, `x` names and binds the
 * whole parameter pair while `y` and `z` bind its left and right states. This
 * is structural matching without an external wrapper. It does not describe
 * three unrelated parameters.
 *
 * Linking remains pair-local. At each pair the fold should classify the same
 * small truth table: fresh name, visible identity, definition, application,
 * compound state, or lone state. Each condition performs one local action and
 * then returns to the same recursion. Helpers may clarify a rule but should not
 * hide another traversal or recover meaning by searching a completed graph.
 *
 * Source causality and lexical visibility proceed left-to-right. The recursive
 * implementation need not. A right-first fold may make a closure or result
 * available before its name is tied, provided it receives only the scope
 * established on the causal left and never makes a future sibling visible to
 * the past. Construction direction must not change authored causality.
 *
 * A connection is legal only from the current pair and identities in its
 * lexical history. It may not reach into a sibling's private descendants or
 * refer to a future identity. Each branch inherits its enclosing scope, while
 * siblings share only identities made visible through that scope.
 *
 * A suspended application is the causal prefix that was authored, not a result
 * containing a hidden hole. Its definition may remain linker context while a
 * later authored argument completes the rightward transition. If no argument
 * follows, its last lone state remains fixed. Once linked, every possible
 * observer focus and continuation already exists in Root.
 *
 * An application retains its complete definition sequence as result history,
 * while exposing the last value of that sequence to an enclosing application.
 * The exposed value is an existing identity; exposing it creates no graph cell.
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
// A completed application carries the result exposed outside its history.
const context = (graph, focus = graph, result) => ({ graph, focus, result })
const output = state => state.result ?? state.focus
// Keep the observable state while placing it in a larger history.
const retain = (graph, state) => context(
  Object.freeze(graph), state.focus, state.result)
// An exposed value is linker knowledge, not another edge in the graph. The
// outer map already lives for exactly one link and accepts identity keys.
const exposed = (graph, stack) => stack[0].get(graph)
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
  if (ref) return context(ref)

  const found = find(node, copies)

  // A branch already being copied keeps the same identity and closes a cycle.
  if (found) return context(found)

  // Named atoms and definitions without captured bindings are already stable.
  if (isNamed(node) && (!isDefinition(node) || !captures(node, bindings)))
    return context(node)

  const visible = isDefinition(node[0]) && (
    find(node[0], copies)
      ?? lookup(node[0]['symbol'], stack))
  const isVisible = Boolean(visible)
  const isNew = isDefinition(node[0]) && !isVisible
  const previous = exposed(node, stack)

  // A visible definition on the left is being applied to the right side.
  if (isVisible) {
    const argument = copy(node[1], stack, bindings, states, copies)
    const application = [visible, output(argument)]
    const result = instantiate(application, stack, bindings, states)
    return argument.graph === output(argument)
      ? result
      : retain([argument.graph, result.graph], result)
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
    : copy(node[0], stack, bindings, states, copies).graph
  const following = copy(node[1], stack, bindings, states, copies)
  branch[1] = following.graph

  // A new definition on the left extends this local scope before observation
  // continues on the right. The enclosing pair is a sequence, not a call.
  if (isNew)
    return retain(branch, following)

  const copied = isDefinition(node)
    ? context(Object.freeze(branch))
    : instantiate(branch, stack, bindings, states)

  // A linked application may now look like an ordinary pair. Retain the
  // value it exposed when substituting its parameter identities.
  if (previous && previous !== node) {
    const value = copy(previous, stack, bindings, states, copies)
    return context(copied.graph, copied.focus, output(value))
  }

  return copied
}

const instantiate = (graph, stack, bindings = [], states = []) => {
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
    return context(Object.freeze(graph))

  const bound = match(definition[0], args)

  // Too few arguments leave the application suspended at this frontier.
  if (!bound) return context(Object.freeze(graph))

  const state = states.find(([defined, previous]) =>
    defined === definition
      && previous.every(([, arg], i) => arg === bound[i][1]))

  // The same definition and argument identities are the same state. Reusing
  // its unfinished graph closes recurrence into a cycle.
  if (state)
    return context(
      state[2], state[2], exposed(state[2], stack) ?? state[2])

  states.push([definition, bound, graph])
  // Inner parameters precede outer bindings, so they shadow them.
  bindings = [...bound, ...bindings]
  // A definition remains visible inside its own body, allowing recurrence.
  stack = [...stack, definition]
  graph[0] = args
  const result = copy(definition[1], stack, bindings, states)
  graph[1] = result.graph
  Object.freeze(graph)
  stack[0].set(graph, output(result))
  return context(graph, graph, output(result))
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
    const argument = fold(right, stack, false)
    graph[0] = ref
    graph[1] = output(argument)
    const result = instantiate(graph, stack)
    return argument.graph === output(argument)
      ? result
      : retain([argument.graph, result.graph], result)
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
    const result = fold(body, stack)
    graph[1] = result.graph
    return context(Object.freeze(graph))
  }

  // A pair on the left happens before the following sibling on the right.
  const previous = fold(left, stack)
  graph[0] = previous.graph
  const following = fold(right, stack)
  graph[1] = following.graph

  // A following sibling supplies the next argument to a suspended call.
  if (isSuspended(previous.focus)) {
    const applied = instantiate(graph, stack)
    return retain(graph, applied)
  }

  // A following sibling applies to the result of a completed call.
  if (previous.result) {
    const application = graph[1] = [previous.result, graph[1]]
    const applied = isDefinition(application[0])
      ? instantiate(application, stack)
      : context(Object.freeze(application), application, application)
    return retain(graph, applied)
  }

  // A definition extends the visible library; observation begins after it.
  if (isDefinition(previous.focus))
    return retain(graph, following)

  // Otherwise this pair is the latest observable frontier.
  return context(Object.freeze(graph))
}

export const link = (source, imports = {}) => {
  try {
    // Retain the source shape, lower it to pairs, then link identities in the
    // pair graph. Construction retains its history and exposes its last focus.
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
