import { applyArgs, isFixed, isList, serializeList } from './shared.js'

const mapPair = (pair, mapChild) => {
  if (pair.length === 0) return []
  if (pair.length !== 2) return pair
  return [mapChild(pair[0]), mapChild(pair[1])]
}

const printTerm = term =>
  isList(term) ? serializeList(term, printTerm) : String(term)

const projectByTraversal = (node, labels = new Map(), seen = new Set()) => {
  if (isFixed(node)) {
    if (!labels.has(node)) labels.set(node, labels.size)
    return labels.get(node)
  }

  if (isList(node)) {
    if (seen.has(node)) {
      if (!labels.has(node)) labels.set(node, labels.size)
      return labels.get(node)
    }

    const nextSeen = new Set(seen).add(node)
    return mapPair(node, child => projectByTraversal(child, labels, nextSeen))
  }

  return node
}

const containsNode = (root, needle) => {
  const seen = new Set()
  const stack = [root]

  while (stack.length) {
    const node = stack.pop()
    if (node === needle) return true
    if (!isList(node) || seen.has(node)) continue

    seen.add(node)
    node.forEach(child => stack.push(child))
  }

  return false
}

const visibleNodes = (graph, nodes) =>
  nodes.filter(node => containsNode(graph, node))

const numberedLabels = (sequence, crossings) =>
  [...sequence, ...crossings.filter(node => !sequence.includes(node))]
    .reduce((labels, node, index) => labels.set(node, index), new Map())

const collectLabelsOutsideAtomBranches = (
  node,
  labels,
  visible = new Set()
) => {
  const seen = new Set()
  const stack = [{ node, blocked: false }]

  while (stack.length) {
    const current = stack.pop()
    if (labels.has(current.node) && !current.blocked) {
      visible.add(current.node)
    }
    if (!isList(current.node) || seen.has(current.node)) continue

    seen.add(current.node)
    current.node.forEach(child =>
      stack.push({
        node: child,
        blocked: current.blocked || !isList(current.node[0])
      }))
  }

  return visible
}

const projectPayload = (node, labels, seen = new Set()) => {
  if (seen.has(node)) return projectByTraversal(node)
  if (isFixed(node)) {
    return projectPayload(node[1], labels, new Set(seen).add(node))
  }
  if (labels.has(node)) {
    return projectPayload(node[1], labels, new Set(seen).add(node))
  }
  if (isList(node)) {
    const nextSeen = new Set(seen).add(node)
    return mapPair(node, child => projectPayload(child, labels, nextSeen))
  }
  return node
}

const projectWithLabels = (
  node,
  labels,
  visible,
  blocked = false,
  seen = new Set(),
  used = new Set()
) => {
  if (labels.has(node)) {
    if (blocked && !visible.has(node)) {
      return projectPayload(node[1], labels)
    }
    used.add(node)
    return labels.get(node)
  }

  if (!isList(node)) return node
  if (seen.has(node)) return projectByTraversal(node)

  const nextSeen = new Set(seen).add(node)
  return mapPair(node, child =>
    projectWithLabels(
      child,
      labels,
      visible,
      blocked || !isList(node[0]),
      nextSeen,
      used
    ))
}

export function project(node, sequence = [], crossings = [], seen = new Set()) {
  if (isList(node) && seen.has(node)) return projectByTraversal(node)

  const active = visibleNodes(node, sequence)
  const activeCrossings = visibleNodes(node, crossings)
  if (!active.length && !activeCrossings.length) return projectByTraversal(node)

  const labels = numberedLabels(active, activeCrossings)
  const used = new Set()
  const visible = collectLabelsOutsideAtomBranches(node, labels)
  const template =
    projectWithLabels(node, labels, visible, false, new Set(), used)
  const args = active
    .filter(slot => used.has(slot))
    .map(slot => {
      const nextSeen = new Set(seen).add(node).add(slot)
      return project(slot[1], sequence, crossings, nextSeen)
    })
  return applyArgs(template, args)
}

/**
 * Serializes a graph to Lisp-facing notation.
 *
 * Without `sequence`, cycles are numbered by graph traversal. With `sequence`,
 * labels come from the caller's chosen argument order. `crossings` names any
 * extra cycles the caller wants printed as slots instead of reconstructed by
 * traversal.
 *
 * @param {*} graph
 * @param {*[]} [sequence]
 * @param {*[]} [crossings]
 * @returns {string}
 */
export const serialize = (graph, sequence = [], crossings = []) =>
  printTerm(project(graph, sequence, crossings))
