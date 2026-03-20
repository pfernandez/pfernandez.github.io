/**
 * @module proofs/utils
 *
 * Pure helper functions shared by the proofs runner and its direct tests.
 * These stay small on purpose so the executable claims can point at concrete,
 * inspectable structure rather than hide logic inside the harness.
 */

import { traceCollapse } from '../collapse/index.js'

const isEmpty = term => Array.isArray(term) && term.length === 0
const isAtom = term => !Array.isArray(term)

/**
 * Count non-empty pair nodes in a term.
 *
 * Empty leaves and atoms contribute zero. A binary pair contributes one plus
 * the count of its left and right branches.
 *
 * @param {*} term
 * @returns {number}
 */
export const countPairs = term =>
  isAtom(term) || isEmpty(term)
    ? 0
    : 1 + countPairs(term[0]) + countPairs(term[1])

/**
 * Convert a binary-pair term into its Dyck-word skeleton.
 *
 * We treat each pair node as one matched excursion: descend with `(`,
 * return with `)`, then continue through the right branch.
 *
 * @param {*} term
 * @returns {string}
 */
export const dyckWord = term =>
  isAtom(term) || isEmpty(term)
    ? ''
    : `(${dyckWord(term[0])})${dyckWord(term[1])}`

/**
 * Enumerate all pure Catalan pair trees up to a given pair count.
 *
 * The result includes the empty leaf at size 0 and then every binary shape for
 * sizes `1..maxPairs`, ordered by the recursive left-size split.
 *
 * @param {number} maxPairs
 * @returns {Array<*>}
 */
export const generateCatalanPairs = maxPairs => {
  const memo = new Map([[0, [[]]]])

  const read = size => {
    if (memo.has(size)) return memo.get(size)

    const pairs = []
    for (let leftSize = 0; leftSize < size; leftSize++) {
      const rightSize = size - 1 - leftSize
      for (const left of read(leftSize)) {
        for (const right of read(rightSize)) {
          pairs.push([left, right])
        }
      }
    }

    memo.set(size, pairs)
    return pairs
  }

  return Array.from({ length: maxPairs + 1 }, (_, size) => read(size)).flat()
}

/**
 * Normalize a term by repeatedly applying the single-step collapse trace.
 *
 * The returned `steps` array contains every intermediate trace, including the
 * final stable one.
 *
 * @param {*} term
 * @returns {{ after: *, steps: Array<{ after: *, changed: boolean, frames: Array<object> }> }}
 */
export const normalizeTerm = term => {
  const steps = []

  const visit = current => {
    const trace = traceCollapse(current)
    steps.push(trace)
    return trace.changed ? visit(trace.after) : trace.after
  }

  return { after: visit(term), steps }
}

/**
 * Expand a term into Dyck-prefix state after each token.
 *
 * Each state records the running open/close counters plus the derived
 * `time`, `position`, and interval proxy `uv`.
 *
 * @param {*} term
 * @returns {Array<{ token: string, opens: number, closes: number, time: number, position: number, interval: number }>}
 */
export const dyckPrefixStates = term => {
  let opens = 0
  let closes = 0

  return [...dyckWord(term)].map(token => {
    token === '(' ? opens++ : closes++

    const time = opens + closes
    const position = opens - closes

    return {
      token,
      opens,
      closes,
      time,
      position,
      interval: opens * closes
    }
  })
}
