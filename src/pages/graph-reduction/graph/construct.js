import {
  application,
  encodeTemplateApplication,
  materializeGraph,
  resolveStagedFolds
} from './compiler.js'
import { applyArgs, isList, isPair } from './shared.js'

const applicationSplits = term =>
  isPair(term)
    ? [[term, []],
       ...applicationSplits(term[0]).map(([head, args]) =>
         [head, [...args, term[1]]])]
    : [[term, []]]

const denseSlotError = error =>
  /dense slots/i.test(error.message)

const constructTemplateApplication = term =>
  applicationSplits(term).reduce((match, [head, args]) => {
    if (match) return match

    try {
      return encodeTemplateApplication(head, args, constructTerm)
    }
    catch (error) {
      if (denseSlotError(error)) return null
      throw error
    }
  }, null)

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
 * Constructs the graph consumed by `observe` from one folding-instruction term.
 *
 * `construct` is intentionally small. It knows arrays, numbers, and temporary
 * atoms; numeric pair shapes are read as folding instructions, and everything
 * else is materialized as ordinary pair structure. Program constructs such as
 * `def` and `defn` are handled by `encode`, not here.
 *
 * @param {import('./parse.js').SourceForm} term
 * @returns {*}
 */
export const construct = term =>
  materializeGraph(resolveStagedFolds(constructTerm(term)))
