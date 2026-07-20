import { err, parse } from './parse.js'

// Every node is a cell: a two-element array. cell[0] is the function side
// and cell[1] is the argument side, so the application (f x) is the cell
// [f, x]. There are no tags; every role is recognized by shape:
//   atom        both sides point at the cell itself
//   slot        a parameter: itself on the left, its definition on the right
//   answer      itself on the left, a result on the right
//   definition  its right side is a slot pointing back at it

const isSymbol = form =>
  typeof form === 'string'

// A scope is a list of [name, cell] pairs; first match wins.
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

// One cell per spelling in a compiled program, so atoms compare by identity.
const intern = (spelling, scope) => {
  if (!scope.atoms.has(spelling)) {
    const cell = []
    cell[0] = cell
    cell[1] = cell
    scope.atoms.set(spelling, remember(scope, cell, spelling))
  }
  return scope.atoms.get(spelling)
}

// Left-nested application: applyArgs(f, [a, b]) is ((f a) b).
const applyArgs = (head, args) =>
  args.reduce((node, arg) => [node, arg], head)

// A symbol means its binding if it has one, otherwise an atom; a list is
// its head applied to each item in turn.
const buildGraph = (form, scopes, scope) =>
  !Array.isArray(form)
    ? isSymbol(form) && lookup(form, scopes) || intern(form, scope)
    : form.length
      ? applyArgs(buildGraph(form[0], scopes, scope),
                  form.slice(1).map(item => buildGraph(item, scopes, scope)))
      : intern('()', scope)

// A top-level (name form) where name is unbound introduces a binding.
const isBindingForm = (form, scope) =>
  Array.isArray(form) && form.length === 2
    && isSymbol(form[0]) && !binding(form[0], scope.names)

// Walk the form's left edge collecting parameter names, innermost first -
// the order arguments are supplied; null if there are none.
const parameters = (form, scope, names = []) =>
  Array.isArray(form) && form.length === 2 && isSymbol(form[1])
      && !binding(form[1], scope.names) && !names.includes(form[1])
    ? parameters(form[0], scope, [form[1], ...names])
    : names.length ? names : null

// The definition is built from the form; each parameter becomes a slot pointing
// back at it. The name binds before the form builds, so self-reference is a
// cycle, not an expansion.
const define = ([name, form], scope) => {
  const parameterNames = parameters(form, scope)
  if (!parameterNames) err('Definitions need a body and at least one slot')

  const definition = remember(scope, [], name)
  const parameterBindings = parameterNames.map(name => {
    const slot = remember(scope, [], name)
    slot[0] = slot
    slot[1] = definition
    return [name, slot]
  })

  scope.names.push([name, definition])
  definition.push(...buildGraph(form, [parameterBindings, scope.names], scope))
}

const replace = (node, from, to, seen = new Set()) => {
  if (node === from) return to
  if (!Array.isArray(node) || seen.has(node)) return node

  seen.add(node)
  node.forEach((item, i) => { node[i] = replace(item, from, to, seen) })
  return node
}

// A binding without slots names raw graph structure. References to the name
// inside its own form become references to the completed value.
const bindValue = ([name, form], scope) => {
  const placeholder = []
  const entry = [name, placeholder]

  scope.names.push(entry)
  const graph = buildGraph(form, [scope.names], scope)
  entry[1] = remember(scope, replace(graph, placeholder, graph), name)
}

const bindForm = (form, scope) =>
  parameters(form[1], scope) ? define(form, scope) : bindValue(form, scope)

const focusForm = (form, scope) => {
  if (isBindingForm(form, scope)) return void bindForm(form, scope)
  return reduceGraph(buildGraph(form, [scope.names], scope))
}

// Observation stops where the function side is the cell itself: atoms,
// slots, and answers are all stable.
const isStable = node =>
  Array.isArray(node) && node.length === 2 && node[0] === node

// The outermost cell built by define: its argument side is a slot pointing
// back at it.
const isDefinition = node =>
  Array.isArray(node) && !isStable(node)
    && isStable(node[1]) && node[1][1] === node

// Complete cells need no reduction: stable cells are finished, definitions
// wait.
const isComplete = node =>
  isStable(node) || isDefinition(node)

const isAtom = node =>
  isStable(node) && node[1] === node

const isSlot = node =>
  isStable(node) && isDefinition(node[1])
    && definitionBody(node[1])[1].includes(node)

const isAnswer = node =>
  isStable(node) && !isAtom(node) && !isSlot(node)

// A completed answer on the left spine can be used as the head of a later
// call. Reopen only the answer cell, not the enclosing application, so any
// arguments already applied to that answer stay on the spine.
const reopenAnswer = node => {
  const seen = new Set()
  let parent = node

  while (!isComplete(parent) && !seen.has(parent)) {
    seen.add(parent)

    if (isAnswer(parent[0]) && isComplete(parent[0][1])) {
      parent[0] = parent[0][1]
      return true
    }

    parent = parent[0]
  }

  return false
}

// Read a left-nested application as a call: ((K a) b) is head K, args [a, b].
const call = (node, args = []) => {
  const seen = new Set()
  const nextArgs = [...args]
  let head = node

  while (!isComplete(head) && !seen.has(head)) {
    seen.add(head)
    nextArgs.unshift(head[1])
    head = head[0]
  }

  return { head, args: nextArgs }
}

// Strip parameter applications to reach the body; slots return in the order
// arguments are supplied. A repeated slot belongs to the body, as in M.
const definitionBody = (definition, node = definition, slots = []) =>
  isStable(node[1]) && node[1][1] === definition && !slots.includes(node[1])
    ? definitionBody(definition, node[0], [node[1], ...slots])
    : [node, slots]

// Copy with each slot replaced by its argument; complete cells stay shared, and
// copies keep sharing and cycles intact in the copy.
const substitute = (node, substitutions, copies = new Map()) => {
  const match = substitutions.find(([from]) => node === from)
  if (match) return match[1]
  if (isComplete(node)) return node
  if (copies.has(node)) return copies.get(node)

  const copy = []
  copies.set(node, copy)
  node.forEach(item => copy.push(substitute(item, substitutions, copies)))
  return copy
}

// An in-progress call of the same definition with identical arguments;
// each active call is [definition, args, focus].
const isSameCall = (head, args, [definition, priorArgs]) =>
  definition === head
      && priorArgs.length === args.length
      && priorArgs.every((arg, i) => arg === args[i])

const findActiveCall = (head, args, activeCalls) =>
  activeCalls.find(activeCall => isSameCall(head, args, activeCall))

// A completed call returns its focus: the call's shape with the answer at
// its head, so observation runs to the answer and the right side is the result.
// Arguments beyond the slots stay applied to the body.
const reduceGraph = (node, activeCalls = [], seen = new Set()) => {
  if (isComplete(node) || seen.has(node)) return node
  seen.add(node)

  const application = call(node)
  const bodyAndSlots = isDefinition(application.head)
    && definitionBody(application.head)

  if (!bodyAndSlots || application.args.length < bodyAndSlots[1].length) {
    if (reopenAnswer(node)) {
      seen.delete(node)
      return reduceGraph(node, activeCalls, seen)
    }

    // Inert applications may still be source-authored cyclic structure. Reduce
    // their children in place so the cycle remains the authored cycle.
    node.forEach((item, i) => {
      node[i] = reduceGraph(item, activeCalls, seen)
    })
    return node
  }

  const [body, slots] = bodyAndSlots
  const reducedArgs =
    application.args.map(arg => reduceGraph(arg, activeCalls, seen))
  const activeCall = findActiveCall(
    application.head,
    reducedArgs,
    activeCalls)
  if (activeCall) return activeCall[2]

  const answer = []
  const focus = applyArgs(answer, reducedArgs)
  const substitutions = slots.map((slot, i) => [slot, reducedArgs[i]])
  const bodyWithArgs = substitute(
    applyArgs(body, reducedArgs.slice(slots.length)),
    substitutions)

  answer[0] = answer
  answer[1] = reduceGraph(
    bodyWithArgs,
    [[application.head, reducedArgs, focus], ...activeCalls],
    new Set())

  return focus
}

// Definitions extend the scope; the last remaining form is the focus.
export const compile = source => {
  const scope = { atoms: new Map(), legend: [], names: [] }
  let focus

  for (const form of parse(source))
    focus = focusForm(form, scope)

  if (focus === undefined) err('Missing focus')
  return { graph: focus, legend: scope.legend }
}
