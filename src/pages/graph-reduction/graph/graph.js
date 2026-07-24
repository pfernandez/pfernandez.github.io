// Pure graph relations. This layer knows only two-sided array nodes and their
// identities. It does not know source text, symbols, bindings, or legends.

// Left-nested application: applyArgs(f, [a, b]) is ((f a) b).
export const applyArgs = (head, args) =>
  args.reduce((node, arg) => [node, arg], head)

// Observation stops where the function side is the node itself: atoms,
// slots, and answers are all stable.
const isStable = node =>
  Array.isArray(node) && node.length === 2 && node[0] === node

// The outermost node built by a definition: its argument side is a slot
// pointing back at it.
const isDefinition = node =>
  Array.isArray(node) && !isStable(node)
    && isStable(node[1]) && node[1][1] === node

// Complete nodes need no reduction: stable nodes are finished, definitions
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

// Copy with each slot replaced by its argument. Complete nodes stay shared;
// copied nodes keep sharing and cycles intact within the copy.
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
  activeCalls,
  seen,
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

// One reducer keeps the answer identities created while reducing a program.
export const createReducer = () => {
  const answers = new WeakMap()

  return node => reduceGraph(node, [], new Set(), answers)
}
