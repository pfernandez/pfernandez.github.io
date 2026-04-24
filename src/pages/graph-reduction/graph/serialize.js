import {
  applyArgs,
  argumentClosures,
  isFixed,
  isList,
  isPair,
  serializeList
} from './shared.js'

const uniqueByIdentity = values => [...new Set(values)]

const mapBinary = (pair, mapChild) => {
  if (pair.length === 0) return []
  if (pair.length !== 2) return pair
  return [mapChild(pair[0]), mapChild(pair[1])]
}

const serializeTerm = term =>
  isList(term) ? serializeList(term, serializeTerm) : String(term)

const canonicalProject = (node, labels = new Map()) => {
  if (isFixed(node)) {
    if (!labels.has(node)) labels.set(node, labels.size)
    return labels.get(node)
  }

  if (isList(node)) {
    return mapBinary(node, child => canonicalProject(child, labels))
  }

  return node
}

const mergeCounts = (left, right) =>
  [...right].reduce((counts, [group, count]) =>
    new Map(counts).set(group, (counts.get(group) ?? 0) + count),
                    left)

const foldCounts = node => {
  const meta = argumentClosures.get(node)
  if (meta) return new Map([[meta.group, 1]])
  if (!isPair(node) || isFixed(node)) return new Map()
  return mergeCounts(foldCounts(node[0]), foldCounts(node[1]))
}

const childFoldCounts = node =>
  isPair(node) && !isFixed(node)
    ? [foldCounts(node[0]), foldCounts(node[1])]
    : []

const foldBoundaryGroup = (node, totals, counts, activeGroups) =>
  [...counts.keys()].find(group =>
    activeGroups.has(group)
    && counts.get(group) === totals.get(group)
    && !childFoldCounts(node).some(child =>
      child.get(group) === totals.get(group)))

const collectFoldClosures = (node, group) => {
  const meta = argumentClosures.get(node)
  if (meta?.group === group) return [node]
  if (!isPair(node) || isFixed(node)) return []
  return [...collectFoldClosures(node[0], group),
          ...collectFoldClosures(node[1], group)]
}

const activeFoldGroups = (node, blocked = false) => {
  if (blocked) return new Set()

  const meta = argumentClosures.get(node)
  const groups = meta ? [meta.group] : []
  if (!isPair(node) || isFixed(node)) return new Set(groups)

  return new Set([...groups,
                  ...activeFoldGroups(node[0]),
                  ...activeFoldGroups(node[1], !isList(node[0]))])
}

const projectFilled = (node, seen = []) => {
  if (seen.includes(node)) return canonicalProject(node)

  const meta = argumentClosures.get(node)
  if (meta) return projectFilled(meta.value, [...seen, node])

  if (isList(node)) {
    const nextSeen = [...seen, node]
    return mapBinary(node, child => projectFilled(child, nextSeen))
  }

  return node
}

const projectFoldTemplate = (node, group, slots, activeGroups) => {
  const meta = argumentClosures.get(node)
  if (meta?.group === group) return slots.get(node)
  if (meta) {
    return activeGroups.has(meta.group)
      ? projectProjected(node, foldCounts(node), activeGroups)
      : projectFilled(meta.value)
  }
  if (isFixed(node)) return canonicalProject(node)

  if (isList(node)) {
    return mapBinary(node, child =>
      projectFoldTemplate(child, group, slots, activeGroups))
  }

  return node
}

const projectFold = (node, group, activeGroups) => {
  const closures = uniqueByIdentity(collectFoldClosures(node, group))
    .sort((left, right) =>
      argumentClosures.get(left).slot - argumentClosures.get(right).slot)
  const slots = new Map(closures.map((closure, index) => [closure, index]))
  const template = projectFoldTemplate(node, group, slots, activeGroups)
  const args = closures.map(closure =>
    project(argumentClosures.get(closure).value))

  return applyArgs(template, args)
}

const projectProjected = (node, totals, activeGroups) => {
  const meta = argumentClosures.get(node)
  if (meta && !activeGroups.has(meta.group)) return projectFilled(meta.value)

  const counts = foldCounts(node)
  const group = foldBoundaryGroup(node, totals, counts, activeGroups)
  if (group) return projectFold(node, group, activeGroups)
  if (isFixed(node)) return canonicalProject(node)

  if (isList(node)) {
    return mapBinary(node, child =>
      projectProjected(child, totals, activeGroups))
  }

  return node
}

export function project(node) {
  const totals = foldCounts(node)
  return totals.size
    ? projectProjected(node, totals, activeFoldGroups(node))
    : canonicalProject(node)
}

/**
 * Serializes a term to the Lisp-facing folding-instruction notation.
 *
 * Plain atoms, empty lists, and ordinary pairs serialize as canonical binary
 * S-expressions. Compiler-created fixed-point argument closures carry hidden
 * fill-order metadata. Active closures serialize as reversible folding
 * instructions by replacing the remaining closures with dense slot numbers and
 * appending their stored argument payloads in fill order. A closure is active
 * when it remains on an observer-visible path.
 *
 * The numeric atoms in this projection always name fixed pairs. In a folding
 * instruction they are ordered slots from one compiler-created closure group;
 * outside such a group they are traversal-local labels for raw fixed pairs.
 * This keeps the notation graph-honest: both uses point at the same primitive
 * `[self, value]` shape, while their role is determined by projection context.
 *
 * This projection is intentionally not a literal object-graph dump. The graph
 * still contains shared self-referential closures, and `observe` still rewrites
 * those closures by identity. The folding form is the paper/worked-example
 * view: repeated slot numbers describe where the same remaining argument will
 * be folded, while the staged arguments after the template show the values
 * already present inside the closure payloads.
 *
 * Passive compiler closures, such as arguments under an atom-headed pair that
 * the observer will not enter, serialize as their filled source values. This
 * keeps settled source-level terms readable without giving `observe` any
 * knowledge of definitions or folds. Manually constructed closures without
 * compiler metadata fall back to traversal-local labels so serialization
 * remains finite for arbitrary pair graphs.
 *
 * @param {*} pair
 * @returns {string}
 */
export const serialize = pair => serializeTerm(project(pair))
