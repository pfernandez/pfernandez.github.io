import {
  application,
  encodeTemplateApplication,
  resolveDelayedCalls,
  templateArity
} from './encode.js'
import { materialize } from './materialize.js'
import { applyArgs, isList, isPair } from './shared.js'

const applicationSplits = term =>
  isPair(term)
    ? [[term, []],
       ...applicationSplits(term[0]).map(([head, args]) =>
         [head, [...args, term[1]]])]
    : [[term, []]]

const denseSlotError = error =>
  /dense slots/i.test(error.message)

const templateCandidate = ([head, args], index) => {
  try {
    const arity = templateArity(head)
    return arity !== null && args.length >= arity
      ? { head, args, arity, index }
      : null
  }
  catch (error) {
    if (denseSlotError(error)) return null
    throw error
  }
}

const betterCandidate = (left, right) => {
  if (!left) return right
  if (!right) return left
  if (right.arity !== left.arity) {
    return right.arity > left.arity ? right : left
  }
  return right.index < left.index ? right : left
}

const constructTemplateApplication = term => {
  const match = applicationSplits(term)
    .map(templateCandidate)
    .reduce(betterCandidate, null)

  return match
    ? encodeTemplateApplication(match.head, match.args, constructTerm)
    : null
}

const constructOrdinaryApplication = term => {
  const [head, args] = application(term)
  const constructedHead = constructTerm(head)
  const constructedArgs = args.map(constructTerm)
  return applyArgs(constructedHead, constructedArgs)
}

const constructTerm = term => {
  if (!isList(term)) return term
  if (term.length === 0) return []

  const templated = constructTemplateApplication(term)
  return templated ?? constructOrdinaryApplication(term)
}

/**
 * Constructs the graph consumed by `observe` from one encoded term.
 *
 * `construct` knows only arrays, numbers, and atoms. Numeric pair shapes are
 * read as argument templates, then materialized as ordinary pair structure.
 * Program constructs such as `def` and `defn` belong to `encode`, not here.
 *
 * @param {import('./parse.js').SourceForm} term
 * @returns {{graph: *, sequence: *[], crossings: *[]}}
 */
export const construct = term =>
  materialize(resolveDelayedCalls(constructTerm(term)), resolveDelayedCalls)
