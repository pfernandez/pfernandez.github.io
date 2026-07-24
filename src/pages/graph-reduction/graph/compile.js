import { err, parse } from './parse.js'

// Every node is a cell: a two-element array. cell[0] is the function side,
// cell[1] is the argument side, and application (f x) is the cell [f, x].
// There are no tags; every role is recognized by shape:
//   atom        both sides point at the cell itself
//   slot        a parameter: itself on the left, its definition on the right
//   answer      itself on the left, a result on the right
//   definition  its right side is a slot pointing back at it

const isSymbol = form =>
  typeof form === 'string'

// A scope is a list of [name, cell] pairs. Earlier scopes shadow later ones.
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

// A symbol means its binding if it has one, otherwise an atom. A list is its
// head applied to each following item in turn.
const buildGraph = (form, scopes, scope) =>
  !Array.isArray(form)
    ? isSymbol(form) && lookup(form, scopes) || intern(form, scope)
    : form.length
      ? applyArgs(buildGraph(form[0], scopes, scope),
                  form.slice(1).map(item => buildGraph(item, scopes, scope)))
      : intern('()', scope)

// A top-level (name form) before the focus introduces a binding.
const isBindingForm = form =>
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
// a stable cell whose payload points back to the definition. The definition
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

const bindForm = (form, scope, parameterNames = parameters(form[1], scope)) =>
  parameterNames ? define(form, scope, parameterNames) : bindValue(form, scope)

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

// Read a left-nested application as a call: ((K a) b) is head K, args [a, b].
const spine = node => {
  const seen = new Set()
  const args = []
  let head = node

  while (!isComplete(head) && !seen.has(head)) {
    seen.add(head)
    args.unshift(head[1])
    head = head[0]
  }

  return { head, args }
}

// Compiler-created answers are recorded by arity. Their left spine contains
// the arguments that produced the answer; any later arguments are new demand
// on the answer payload.
const answerCall = (node, answers) => {
  const { head, args } = spine(node)
  if (!answers.has(head)) return null

  return {
    args: args.slice(answers.get(head)),
    head
  }
}

// Reopening an answer drops its historical arguments and keeps the future
// arguments applied to its payload.
const reopenAnswer = (node, answers) => {
  const answered = answerCall(node, answers)
  if (!answered) return null

  return applyArgs(answered.head[1], answered.args)
}

// Strip parameter applications to reach the body; slots return in the order
// arguments are supplied. A repeated slot belongs to the body, as in M.
const definitionBody = (definition, node = definition, slots = []) =>
  isStable(node[1]) && node[1][1] === definition && !slots.includes(node[1])
    ? definitionBody(definition, node[0], [node[1], ...slots])
    : [node, slots]

// Copy with each slot replaced by its argument. Complete cells stay shared;
// copied cells keep sharing and cycles intact within the copy.
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

// An in-progress call of the same definition with identical arguments.
// Each active call is [definition, args, focus].
const findActiveCall = (head, args, activeCalls) =>
  activeCalls.find(([definition, priorArgs]) =>
    definition === head
      && priorArgs.length === args.length
      && priorArgs.every((arg, i) => arg === args[i]))

// Reduce one call into a history focus: the same argument spine, with a fresh
// answer at its head. Observation walks to that answer; reading right gets the
// result. Extra arguments are applied to the body before it is reduced.
const reduceGraph = (
  node,
  activeCalls = [],
  seen = new Set(),
  answers
) => {
  if (isComplete(node) || seen.has(node)) return node
  seen.add(node)

  const application = spine(node)
  const bodyAndSlots = isDefinition(application.head)
    && definitionBody(application.head)

  if (!bodyAndSlots || application.args.length < bodyAndSlots[1].length) {
    const reopened = reopenAnswer(node, answers)
    if (reopened) return reduceGraph(reopened, activeCalls, seen, answers)

    // Inert applications may still be source-authored cyclic structure. Reduce
    // their children in place so the cycle remains the authored cycle.
    node.forEach((item, i) => {
      node[i] = reduceGraph(item, activeCalls, seen, answers)
    })
    return node
  }

  const [body, slots] = bodyAndSlots
  const reducedArgs =
    application.args.map(arg => reduceGraph(arg, activeCalls, seen, answers))
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
    new Set(),
    answers)
  answers.set(answer, reducedArgs.length)

  return focus
}

// Definitions extend the scope; the last remaining form is the focus.
export const compile = source => {
  const forms = parse(source)
  const scope = {
    atoms: new Map(),
    legend: [],
    names: []
  }
  const answers = new WeakMap()
  const reduceForm = form =>
    reduceGraph(buildGraph(form, [scope.names], scope),
                [], new Set(), answers)

  // First classify each top-level form using only names already seen. Then
  // predeclare definition cells so helper bodies can refer to later helpers
  // without changing how their own parameter slots are detected.
  const plannedScope = { names: [] }
  const plans = forms.slice(0, -1).map(form => {
    if (!isBindingForm(form) || binding(form[0], plannedScope.names))
      return null

    const parameterNames = parameters(form[1], plannedScope)
    plannedScope.names.push([form[0], []])
    return { form, parameterNames }
  })
  let focus

  for (const plan of plans)
    if (plan?.parameterNames)
      scope.names.push([plan.form[0], []])

  forms.forEach((form, i) => {
    if (i < forms.length - 1 && isBindingForm(form))
      bindForm(form, scope, plans[i]?.parameterNames)
    else focus = reduceForm(form)
  })

  if (focus === undefined) err('Missing focus')
  return { graph: focus, legend: scope.legend }
}
