/**
 * Turn authored sequences into one static pair graph by accumulating left and
 * proceeding right. Linking is pair-local, preserves lexical history, and
 * never makes a future or private sibling identity visible. Names guide
 * construction and display; observation follows identities, not spellings.
 *
 * See ../design.md for the complete graph semantics and machine design target.
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
const isFixed = graph => isOpen(graph)
  || Array.isArray(graph) && graph[0] === graph && graph[1] === graph
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
// definition             [input, body]
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

// Match each identity on a transition's left with the branch that fills it.
// Repeated identities constrain their arguments to share that identity too.
const match = (input, args, bindings = []) => {
  const known = find(input, bindings)
  if (known) return known === args ? bindings : undefined

  let matched = isNamed(input)
    ? [...bindings, [input, args]]
    : bindings
  if (isFixed(input)) return matched
  if (isFixed(args)) return

  // A self-edge names a partial argument; it does not fill a distinct state.
  if (isNamed(input)
    && input[0] !== input
    && args[0] === args) return

  if (input[0] !== input) {
    matched = match(input[0], args[0], matched)
    if (!matched) return
  }
  if (input[1] !== input)
    matched = match(input[1], args[1], matched)
  return matched
}

// Children identify a destructured pair. Its name matters to recurrence only
// when the name itself occupies one of the pattern's states.
const stateBindings = bindings => bindings.filter(([input]) =>
  isFixed(input) || input[0] === input)

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
  const isInput = graph => details(graph).input
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
      literal = false,
      frame,
      states,
      template
    } = options
    const next = (node, nextScope = scope, changes = {}) => walk(
      node, nextScope, { ...options, ...changes })

    // A literal capability receives fresh atoms and pairs exactly as authored.
    // Its arguments are data, so visible names cannot resolve or define scope.
    if (literal) {
      if (isSymbol(expression)) return context(atom(expression), scope)

      const before = next(expression[0])
      const after = next(expression[1])
      return context([before.graph, after.graph], scope)
    }

    // A symbol reuses the nearest visible identity. The first occurrence in a
    // transition's local frame shadows its surroundings and identifies itself.
    if (isSymbol(expression)) {
      const known = scope.get(expression)
      if (frame && known !== frame.get(expression))
        return context(known, scope)

      if (!frame) {
        const { ref } = resolve(expression, scope, bindings)
        if (ref) return context(ref, scope)
        if (template?.['symbol'] === expression)
          return context(template, extend(scope, expression, template))
      }

      const graph = atom(expression)
      if (frame) remember(graph, { input: true })
      return context(graph, extend(scope, expression, graph))
    }

    // A compound head identifies the pair within the same local frame.
    if (frame) {
      const graph = []
      const [left, right] = expression
      const named = isSymbol(left) && Array.isArray(right)
      const pair = named ? right : expression
      let local = scope

      if (named) {
        const known = scope.get(left)
        if (known !== frame.get(left)) return context(known, scope)

        identify(graph, left)
        remember(graph, { input: true })
        local = extend(scope, left, graph)
      }

      const before = next(pair[0], local)
      const after = next(pair[1], before.scope)
      graph[0] = before.graph
      graph[1] = after.graph
      return context(graph, after.scope)
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
        literal: ref['symbol'].literal,
        template: isInput(visible) || isCallable(template?.[0])
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

    // Inside a value, a compound head names the pair. A bound input either
    // becomes a call above, fills an open identity, or reuses a completed one.
    if (!definitions && isSymbol(left) && Array.isArray(right)) {
      const transition = isSymbol(right[0])
        && resolve(right[0], scope, bindings).ref

      if (!isInput(visible) && transition && isCallable(transition)) {
        const state = next(right, scope, {
          definitions: false,
          template
        })
        if (state.focus['symbol'] !== left) identify(state.focus, left)
        state.scope = extend(scope, left, state.focus)
        return state
      }

      if (isInput(visible) && ref !== visible) {
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
      const input = next(pattern, local, {
        frame: local
      })
      graph[0] = input.graph
      remember(graph, {
        bindings,
        body,
        definition: true,
        scope: input.scope
      })
      const result = next(body, input.scope, {
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

export const link = (program, imports = {}) => {
  let source

  try {
    // Retain the source shape, lower it to pairs, then link identities in the
    // pair graph. Construction retains its history and exposes its last focus.
    source = typeof program === 'string' ? program : program.source
    const ast = typeof program === 'string' ? parse(source) : program.ast
    const pairs = decompose(ast)
    const linked = compile(pairs, imports)

    freeze(linked.graph)

    return { source, ast, pairs, focus: linked.focus, result: linked.result,
             graph: linked.graph }
  } catch (error) {
    const graph = []
    return { source, graph, focus: graph, result: undefined, error }
  }
}
