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

// One cell per spelling, so atoms compare by identity; spellings is the
// reverse map, used for printing.
const atoms = new Map()
export const spellings = new Map()

const intern = spelling => {
  if (!atoms.has(spelling)) {
    const cell = []
    cell[0] = cell
    cell[1] = cell
    atoms.set(spelling, cell)
    spellings.set(cell, spelling)
  }
  return atoms.get(spelling)
}

// Left-nested application: applyArgs(f, [a, b]) is ((f a) b).
const applyArgs = (head, args) =>
  args.reduce((node, arg) => [node, arg], head)

// A symbol means its binding if it has one, otherwise an atom; a list is
// its head applied to each item in turn.
const buildGraph = (form, scopes) =>
  !Array.isArray(form)
    ? isSymbol(form) && lookup(form, scopes) || intern(form)
    : form.length
      ? applyArgs(buildGraph(form[0], scopes),
                  form.slice(1).map(item => buildGraph(item, scopes)))
      : intern('()')

// A top-level (name form) where name is unbound introduces a definition.
const isDefinitionForm = (form, scope) =>
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

  const definition = []
  const parameterBindings = parameterNames.map(name => {
    const slot = []
    slot[0] = slot
    slot[1] = definition
    return [name, slot]
  })

  scope.names.push([name, definition])
  definition.push(...buildGraph(form, [parameterBindings, scope.names]))
}

// Observation stops where the function side is the cell itself: atoms,
// slots, and answers are all stable.
const isStable = node =>
  Array.isArray(node) && node[0] === node

// The outermost cell built by define: its argument side is a slot pointing
// back at it.
const isDefinition = node =>
  Array.isArray(node) && !isStable(node)
    && isStable(node[1]) && node[1][1] === node

// Complete cells need no reduction: stable cells are finished, definitions wait.
const isComplete = node =>
  isStable(node) || isDefinition(node)

// Read a left-nested application as a call: ((K a) b) is head K, args [a, b].
const call = (node, args = []) =>
  isComplete(node) ? { head: node, args }
    : call(node[0], [node[1], ...args])

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

// Calls that never repeat would reduce forever; compile sets the budget.
let patience = 0

// A completed call returns its focus: the call's shape with the answer at
// its head, so observation runs to the answer and select reads the result.
// Arguments beyond the slots stay applied to the body.
const reduceGraph = (node, activeCalls = []) => {
  if (isComplete(node)) return node
  if (--patience < 0) err('Reduction never settles')

  const { head, args } = call(node)
  const bodyAndSlots = isDefinition(head) && definitionBody(head)

  if (!bodyAndSlots || args.length < bodyAndSlots[1].length)
    return node.map(item => reduceGraph(item, activeCalls))

  const [body, slots] = bodyAndSlots
  const reducedArgs = args.map(arg => reduceGraph(arg, activeCalls))
  const activeCall = findActiveCall(head, reducedArgs, activeCalls)
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
    [[head, reducedArgs, focus], ...activeCalls])

  return focus
}

// Definitions extend the scope; the last remaining form is the focus.
export const compile = source => {
  const scope = { names: [] }
  let focus

  patience = 1e6

  for (const form of parse(source))
    focus = isDefinitionForm(form, scope)
      ? void define(form, scope)
      : reduceGraph(buildGraph(form, [scope.names]))

  if (focus === undefined) err('Missing focus')
  return focus
}
