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
 * observer knows only the resulting identities. The walk applies these rules
 * at every level:
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
 *     (a b c d)          means a = (b c), where c = (c d)
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
 * Root follows the same rule as every other pair. If source later permits an
 * optional `(root (...))` tag, it must name the outermost pair without adding a
 * wrapper, input, or self-edge. It must not be mistaken for a unary function
 * merely because `root` is new.
 *
 * Parameter patterns obey the same rule. In `(x y z)`, `x` names and binds the
 * whole parameter pair while `y` and `z` bind its left and right states. This
 * is structural matching without an external wrapper. It does not describe
 * three unrelated parameters.
 *
 * Linking remains pair-local. At each pair the walk classifies the same
 * small truth table: fresh name, visible identity, definition, application,
 * compound state, or lone state. Each condition performs one local action and
 * then returns to the same recursion. Helpers may clarify a rule but should not
 * hide another traversal or recover meaning by searching a completed graph.
 *
 * Source causality and lexical visibility proceed left-to-right. The recursive
 * implementation need not. A right-first walk may make a closure or result
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

// Names annotate identities for linking and display; neither edge depends on
// the spelling once the graph has been linked.
const identify = (graph, symbol) => {
  graph['symbol'] = symbol

  return graph
}

const isSymbol = node => typeof node === 'string'
const isOpen = graph => graph?.length === 1 && graph[0] === graph
const isFixed = graph => isOpen(graph) || (
  Array.isArray(graph) && graph[0] === graph && graph[1] === graph)
const isNamed = graph => graph?.['symbol'] !== undefined
// Find the identity paired with a source identity.
const find = (node, entries) =>
  entries.find(([source]) => source === node)?.[1]
const atom = symbol => {
  const graph = []
  graph[0] = graph
  return identify(graph, symbol)
}

// The linker uses four structural states; a suspension is an unfinished
// frontier, not a completed causal transition. If it remains unresolved,
// its supplied arguments are the causal prefix that actually occurred:
// atom                   [self, self]
// definition             [parameters, body]
// suspended application  [definition, supplied]
// completed application  [arguments, result]

// Add a later state to the open edge of the arguments already supplied.
const append = (graph, node) => {
  if (isOpen(graph)) graph[1] = node
  else if (graph[0] === graph) {
    graph[0] = graph[1]
    graph[1] = node
  } else graph[1] = append(graph[1], node)

  return graph
}

// Match each parameter identity with the argument branch that fills it.
const match = (parameters, args) => {
  const whole = isNamed(parameters) ? [[parameters, args]] : []
  if (isFixed(parameters)) return whole
  if (isFixed(args)) return

  // A self-edge names a partial argument; it does not fill a distinct state.
  if (isNamed(parameters)
    && parameters[0] !== parameters
    && args[0] === args) return

  const left = parameters[0] === parameters
    ? []
    : match(parameters[0], args[0])
  const right = parameters[1] === parameters
    ? []
    : match(parameters[1], args[1])
  return left && right && [...whole, ...left, ...right]
}

// Children identify a destructured pair. Its name matters to recurrence only
// when the name itself occupies one of the pattern's states.
const stateBindings = bindings => bindings.filter(([parameter]) =>
  isFixed(parameter) || parameter[0] === parameter)

const compile = (tree, imports) => {
  // Scope is persistent: a definition sees exactly the identities visible when
  // it was authored, never a sibling added later to the completed graph.
  const memory = new Map()
  const scope = new Map(Object.entries(imports)
    .map(([name, fn]) => [name, atom(fn)]))
  const details = graph => memory.get(graph) || {}
  const remember = (graph, facts) =>
    memory.set(graph, { ...details(graph), ...facts })
  const isDefinition = graph => details(graph).definition
  const isParameter = graph => details(graph).parameter
  const isCallable = graph => isDefinition(graph)
    || typeof graph?.['symbol'] === 'function'
  const exposed = graph => details(graph).result
  const expose = (graph, result) => remember(graph, { result })
  const extend = (scope, symbol, graph) =>
    new Map(scope).set(symbol, graph)
  const preserve = (graph, template) => template
    && graph.every((node, i) => node === template[i]) ? template : graph

  // A walk retains the complete graph, its observable focus, and the value an
  // enclosing application receives.
  const context = (graph, scope, focus = graph, result) =>
    ({ graph, scope, focus, result })
  const output = state => state.result ?? state.focus
  const retain = (graph, state) => ({ ...state, graph })
  const value = state => exposed(output(state)) ?? output(state)
  const isSuspended = graph => !isNamed(graph)
    && isDefinition(graph?.[0])
    && !exposed(graph)
  const resolve = (symbol, scope, bindings) => {
    const visible = scope.get(symbol)
    return { visible, ref: find(visible, bindings) ?? visible }
  }

  const walk = (expression, scope, options = {}) => {
    const {
      bindings = [],
      definitions = true,
      parameters = false,
      states,
      template
    } = options
    const next = (node, nextScope = scope, changes = {}) => walk(
      node, nextScope, { ...options, ...changes })

    // A parameter always introduces a fresh local identity. A compound head
    // names its parameter pair at any nesting depth.
    if (parameters) {
      if (isSymbol(expression)) {
        const graph = atom(expression)
        remember(graph, { parameter: true })
        return context(graph, extend(scope, expression, graph))
      }

      const graph = []
      const [left, right] = expression
      const named = isSymbol(left) && Array.isArray(right)
      const pair = named ? right : expression
      let local = scope

      if (named) {
        identify(graph, left)
        remember(graph, { parameter: true })
        local = extend(scope, left, graph)
      }

      const before = next(pair[0], local)
      const after = next(pair[1], before.scope)
      graph[0] = before.graph
      graph[1] = after.graph
      return context(graph, after.scope)
    }

    // A lone symbol reuses the identity visible at this exact causal point.
    if (isSymbol(expression)) {
      const { visible, ref } = resolve(expression, scope, bindings)
      if (ref)
        return context(ref, scope)
      if (template?.['symbol'] === expression)
        return context(template, scope)
      return context(atom(expression), scope)
    }

    const graph = []
    const [left, right] = expression
    const resolved = isSymbol(left)
      ? resolve(left, scope, bindings)
      : {}
    const { visible, ref } = resolved
    const isNew = isSymbol(left) && !visible

    // A callable identity consumes the authored argument on its right.
    if (ref && isCallable(ref)) {
      const argument = next(right, scope, {
        definitions: false,
        template: isParameter(visible) || isCallable(template?.[0])
          ? template?.[1]
          : template?.[0]
      })
      graph[0] = ref
      graph[1] = value(argument)
      const applied = isDefinition(ref)
        ? instantiate(graph, scope, bindings, states)
        : context(graph, scope)
      return argument.graph === output(argument)
        ? applied
        : retain([argument.graph, applied.graph], applied)
    }

    // Inside a value, a compound head names the pair. A bound parameter either
    // becomes a call above, fills an open identity, or reuses a completed one.
    if (!definitions && isSymbol(left) && Array.isArray(right)) {
      const transition = isSymbol(right[0])
        && resolve(right[0], scope, bindings).ref

      if (!isParameter(visible) && transition && isCallable(transition)) {
        const state = next(right, scope, {
          definitions: false,
          template
        })
        if (state.focus['symbol'] !== left) identify(state.focus, left)
        state.scope = extend(scope, left, state.focus)
        return state
      }

      if (isParameter(visible) && ref !== visible) {
        if (!isOpen(ref))
          return context(ref, scope)

        const before = next(right[0], scope, { definitions: false })
        const after = next(right[1], before.scope, { definitions: false })
        ref[0] = before.graph
        ref[1] = after.graph
        return context(ref, scope)
      }

      identify(graph, left)
      const local = extend(scope, left, graph)
      const before = next(right[0], local, {
        definitions: false,
        template: template?.[0]
      })
      const after = next(right[1], before.scope, {
        definitions: false,
        template: template?.[1]
      })
      graph[0] = before.graph
      graph[1] = after.graph
      const result = preserve(graph, template)
      return context(result, extend(scope, left, result))
    }

    // A fresh compound head introduces a definition. Its source, template,
    // bindings, and immutable lexical scope are enough for this same walk to
    // instantiate it later.
    if (isNew && Array.isArray(right)) {
      identify(graph, left)
      const local = extend(scope, left, graph)
      const [pattern, body] = right
      const parameters = next(pattern, local, {
        parameters: true
      })
      graph[0] = parameters.graph
      remember(graph, {
        bindings,
        body,
        definition: true,
        scope: parameters.scope
      })
      const result = next(body, parameters.scope, {
        template: template?.[1]
      })
      graph[1] = result.graph
      remember(graph, { template: result.graph })

      if (template && isDefinition(template)
        && result.graph === template[1])
        return context(template, extend(scope, left, template))
      return context(graph, extend(scope, left, graph))
    }

    // A fresh head followed by one state is a named local continuation.
    if (isNew) {
      identify(graph, left)
      const following = next(right, extend(scope, left, graph), {
        template: template?.[1]
      })
      graph[0] = graph
      graph[1] = following.graph
      const result = template && graph[1] === template[1] ? template : graph
      return context(result, extend(scope, left, result))
    }

    // A visible non-callable identity is the left state of a local pair.
    if (ref) {
      const following = next(right, scope, {
        definitions: false,
        template: template?.[1]
      })
      graph[0] = ref
      graph[1] = following.graph
      if (isSuspended(ref))
        return instantiate(graph, scope, bindings, states)
      const result = preserve(graph, template)
      return context(result, scope)
    }

    // Every remaining pair is a left-to-right sequence. Scope produced on the
    // causal left is the only new scope visible while walking the right.
    const previous = next(left, scope, { template: template?.[0] })
    const following = next(right, previous.scope, {
      template: template?.[1]
    })
    graph[0] = previous.graph
    graph[1] = following.graph
    const branch = preserve(graph, template)

    // A following sibling completes a suspended call.
    if (!template && isSuspended(previous.focus)) {
      const applied = instantiate(branch, following.scope, bindings, states)
      return retain(branch, applied)
    }

    // A following sibling continues from the result of a completed call.
    if (!template && previous.result) {
      const application = branch[1] = [previous.result, branch[1]]
      const applied = isDefinition(application[0])
        ? instantiate(application, following.scope, bindings, states)
        : context(application, following.scope, application, application)
      return retain(branch, applied)
    }

    // A definition extends history while exposing the following focus.
    if (isDefinition(previous.focus))
      return retain(branch, following)

    return context(branch, following.scope)
  }

  // A body sees the definition's captured scope, but its application returns
  // to the caller's scope. Private definitions therefore remain private.
  const instantiate = (graph, scope, bindings = [], states = []) => {
    let definition = graph[0]
    let args = graph[1]

    if (isSuspended(definition)) {
      args = append(definition[1], args)
      definition = definition[0]
      graph[0] = definition
      graph[1] = args
    }

    const defined = details(definition)
    if (!defined.definition || !definition[1])
      return context(graph, scope)

    const bound = match(definition[0], args)
    if (!bound) return context(graph, scope)

    const identity = stateBindings(bound)
    const state = states.find(([known, previous]) =>
      known === definition
        && previous.length === identity.length
        && previous.every(([, arg], i) => arg === identity[i][1]))

    if (state)
      return context(state[2], scope, state[2],
        exposed(state[2]) ?? state[2])

    states.push([definition, identity, graph])
    graph[0] = args
    const result = walk(defined.body, defined.scope, {
      bindings: [...bound, ...defined.bindings],
      states,
      template: defined.template
    })
    graph[1] = result.graph
    expose(graph, output(result))
    return context(graph, scope, graph, output(result))
  }

  const linked = walk(tree, scope)
  if (isSuspended(linked.focus)) linked.focus = linked.focus[1]
  return linked
}

// Construction may fill open identities. The returned Root contains only
// complete immutable pairs.
const freeze = (graph, seen = []) => {
  if (!Array.isArray(graph) || seen.includes(graph)) return graph

  seen.push(graph)
  if (isOpen(graph)) graph[1] = graph
  graph.forEach(node => freeze(node, seen))
  return Object.freeze(graph)
}

export const link = (source, imports = {}) => {
  try {
    // Retain the source shape, lower it to pairs, then link identities in the
    // pair graph. Construction retains its history and exposes its last focus.
    const ast = parse(source)
    const pairs = decompose(ast)
    const linked = compile(pairs, imports)

    freeze(linked.graph)

    return { ast, pairs, focus: linked.focus, graph: linked.graph }
  } catch (error) {
    const graph = []
    return { graph, focus: graph, error }
  }
}
