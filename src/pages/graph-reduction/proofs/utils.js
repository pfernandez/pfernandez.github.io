/**
 * @module proofs/utils
 *
 * Pure helper functions shared by the proofs runner and its direct tests.
 * These stay small on purpose so the executable claims can point at concrete,
 * inspectable structure rather than hide logic inside the harness.
 */

import { observe } from '../collapse/utils/observe.js'

const isEmpty = pair => Array.isArray(pair) && pair.length === 0
const isAtom = pair => !Array.isArray(pair)

/**
 * Count non-empty pair nodes in a pair expression.
 *
 * Empty leaves and atoms contribute zero. A binary pair contributes one plus
 * the count of its left and right branches.
 *
 * @param {*} pair
 * @returns {number}
 */
export const countPairs = pair =>
  isAtom(pair) || isEmpty(pair)
    ? 0
    : 1 + countPairs(pair[0]) + countPairs(pair[1])

/**
 * Convert a binary-pair expression into its Dyck-word skeleton.
 *
 * We treat each pair node as one matched excursion: descend with `(`,
 * return with `)`, then continue through the right branch.
 *
 * @param {*} pair
 * @returns {string}
 */
export const dyckWord = pair =>
  isAtom(pair) || isEmpty(pair)
    ? ''
    : `(${dyckWord(pair[0])})${dyckWord(pair[1])}`

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
 * Normalize a pair expression by repeatedly applying single-step collapse.
 *
 * The returned `steps` array contains one entry for each actual collapse.
 *
 * @param {*} pair
 * @returns {{ after: *, steps: Array<{ after: *, changed: boolean, event: object | null }> }}
 */
export const normalizeTerm = pair => {
  const steps = []

  const visit = current => {
    const step = observe(current)
    if (!step.changed) return current
    steps.push(step)
    return visit(step.after)
  }

  return { after: visit(pair), steps }
}

/**
 * Expand a pair expression into Dyck-prefix state after each token.
 *
 * Each state records the running open/close counters plus the derived
 * `time`, `position`, and interval proxy `uv`.
 *
 * @param {*} pair
 * @returns {Array<{ token: string, opens: number, closes: number, time: number, position: number, interval: number }>}
 */
export const dyckPrefixStates = pair => {
  let opens = 0
  let closes = 0

  return [...dyckWord(pair)].map(token => {
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
