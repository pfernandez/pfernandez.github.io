import { traceCollapse } from '../collapse/index.js'

const MAX_PAIRS = 7

const isEmpty = term => Array.isArray(term) && term.length === 0
const isAtom = term => !Array.isArray(term)

const sameTerm = (left, right) => {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false
    if (left.length !== right.length) return false
    if (left.length === 0) return true
    return sameTerm(left[0], right[0]) && sameTerm(left[1], right[1])
  }

  return Object.is(left, right)
}

const expect = (condition, message) => {
  if (!condition) throw new Error(message)
}

const countPairs = term =>
  isAtom(term) || isEmpty(term)
    ? 0
    : 1 + countPairs(term[0]) + countPairs(term[1])

const dyckWord = term =>
  isAtom(term) || isEmpty(term)
    ? ''
    : `(${dyckWord(term[0])})${dyckWord(term[1])}`

const generateCatalanPairs = maxPairs => {
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

const normalize = term => {
  const steps = []

  const visit = current => {
    const trace = traceCollapse(current)
    steps.push(trace)
    return trace.changed ? visit(trace.after) : trace.after
  }

  return { after: visit(term), steps }
}

const exact = ({ id, section, title, run }) => {
  try {
    return { id, section, title, kind: 'exact', status: 'pass', note: run() }
  } catch (error) {
    return {
      id,
      section,
      title,
      kind: 'exact',
      status: 'fail',
      note: String(error?.message || error)
    }
  }
}

const pending = ({ id, section, title, note }) =>
  ({ id, section, title, kind: 'pending', status: 'pending', note })

const exactClaims = () => {
  const catalanPairs = generateCatalanPairs(MAX_PAIRS)

  return [
    exact({
      id: 'identity-collapse',
      section: 'Semantics',
      title: 'Identity collapse returns the right branch directly',
      run: () => {
        const samples = ['x', 42, [], ['a', 'b'], [[[], []], 'tail']]
        for (const sample of samples) {
          const trace = traceCollapse([[], sample])
          expect(trace.changed, 'Root redex should collapse')
          expect(trace.after === sample, 'Collapse should reuse the right branch')
        }

        return `Checked ${samples.length} representative values at the root redex.`
      }
    }),

    exact({
      id: 'locality',
      section: 'Semantics',
      title: 'A collapse step preserves distant structure by reference',
      run: () => {
        const rightA = ['keep', 'me']
        const rightB = [[[], []], 'also-kept']
        const cases =
          [{ before: [[[[], 'a'], 'b'], rightA], keep: rightA },
           { before: [[[[[], []], 'x'], 'y'], rightB], keep: rightB }]

        for (const { before, keep } of cases) {
          const trace = traceCollapse(before)
          expect(trace.changed, 'Case should collapse')
          expect(trace.after[1] === keep, 'Untouched right branch should be shared')
        }

        return `Checked ${cases.length} collapsing terms with preserved distant branches.`
      }
    }),

    exact({
      id: 'schedule',
      section: 'Semantics',
      title: 'The schedule descends left and defers right collapses',
      run: () => {
        const leftStable = [['a', 'b'], [[], 'hidden']]
        const deferred = ['left', [[], 'right']]
        const cases = [[leftStable, deferred], [['atom', 'pair'], [[], []]]]

        for (const before of cases) {
          const trace = traceCollapse(before)
          expect(!trace.changed, 'A deferred right redex should not collapse yet')
          expect(trace.frames.at(-1)?.type === 'stable', 'Trace should end in stability')
          expect(trace.after === before, 'Stable terms should be returned unchanged')
        }

        const competing = traceCollapse([[[], 'left'], [[], 'right']])
        const collapseFrame = competing.frames.find(frame => frame.type === 'collapse')
        expect(collapseFrame?.path === 'root0', 'First collapse should be on the left branch')

        return 'Checked deferred-right examples and a competing-redex example for left-first order.'
      }
    }),

    exact({
      id: 'normalization',
      section: 'Semantics',
      title: 'Finite pure pairs normalize by strictly decreasing pair count',
      run: () => {
        let longest = 0

        for (const pair of catalanPairs) {
          const initialPairs = countPairs(pair)
          const { after, steps } = normalize(pair)
          const changedSteps = steps.filter(step => step.changed)

          longest = Math.max(longest, changedSteps.length)
          expect(steps.at(-1)?.changed === false, 'Normalization should end at a stable trace')
          expect(countPairs(after) <= initialPairs, 'Normalization should not grow the term')

          let currentPairs = initialPairs
          for (const step of changedSteps) {
            const nextPairs = countPairs(step.after)
            expect(nextPairs < currentPairs, 'Each collapse should remove at least one pair')
            currentPairs = nextPairs
          }
        }

        return `Normalized ${catalanPairs.length} pure Catalan pairs up to ${MAX_PAIRS} pair nodes; the longest run took ${longest} collapse steps.`
      }
    }),

    exact({
      id: 'causal-wedge',
      section: 'Geometry',
      title: 'Dyck prefixes stay inside the causal wedge',
      run: () => {
        let prefixCount = 0

        for (const pair of catalanPairs) {
          let opens = 0
          let closes = 0
          let time = 0
          let position = 0

          for (const token of dyckWord(pair)) {
            const previousTime = time
            const previousPosition = position

            if (token === '(') {
              opens++
              position++
            } else {
              closes++
              position--
            }

            time++
            prefixCount++

            expect(opens >= closes, 'A Dyck prefix should never cross below the horizon')
            expect(time === previousTime + 1, 'Each token should advance time by one tick')
            expect(Math.abs(position - previousPosition) === 1,
                   'Each token should move by one unit in x')
          }
        }

        return `Checked ${prefixCount} Dyck prefixes derived from the same ${catalanPairs.length} pure pairs.`
      }
    }),

    exact({
      id: 'interval-proxy',
      section: 'Geometry',
      title: 'The discrete interval proxy agrees with uv',
      run: () => {
        let prefixCount = 0

        for (const pair of catalanPairs) {
          let opens = 0
          let closes = 0

          for (const token of dyckWord(pair)) {
            token === '(' ? opens++ : closes++
            prefixCount++

            const time = opens + closes
            const position = opens - closes
            const interval = (time * time - position * position) / 4

            expect(Number.isInteger(interval), 'Interval proxy should stay integral')
            expect(interval === opens * closes, 'Interval proxy should equal uv')
          }
        }

        return `Checked the interval identity on ${prefixCount} Dyck prefixes.`
      }
    })
  ]
}

const pendingClaims = () =>
  [
    pending({
      id: 'focus',
      section: 'Focus',
      title: 'Focus moves preserve substrate structure',
      note: 'This needs a canonical focus operator first; the current reducer only traces where attention moves during collapse.'
    }),
    pending({
      id: 'focus-commutes',
      section: 'Focus',
      title: 'Focus should commute with normalization up to observation',
      note: 'This becomes executable once focus and observational equivalence are both defined as pure functions.'
    }),
    pending({
      id: 'fixed-points',
      section: 'Focus',
      title: 'Repeated refocusing should expose fixed points or short cycles',
      note: 'This is where Julia-like basin tests belong, but it depends on a real focusStep.'
    }),
    pending({
      id: 'gauge',
      section: 'Histories',
      title: 'Multiway histories should collapse into gauge-equivalent classes',
      note: 'The current kernel is deterministic and single-history, so there is no equivalence quotient to measure yet.'
    }),
    pending({
      id: 'weights',
      section: 'Histories',
      title: 'History weights should factorize locally',
      note: 'Path weights need to be introduced explicitly before any Markov or action-like claims can be checked.'
    }),
    pending({
      id: 'interference',
      section: 'Histories',
      title: 'Complex amplitudes should allow interference',
      note: 'This is intentionally blocked until there is a positive-real weighting mode to compare against.'
    }),
    pending({
      id: 'continuum',
      section: 'Scaling',
      title: 'Large Dyck families should show continuum-like scaling',
      note: 'This will be a measured claim, not a small exact proof, and belongs in a separate empirical harness.'
    }),
    pending({
      id: 'horizon',
      section: 'Scaling',
      title: 'A horizon should separate stable signal from unresolved traffic',
      note: 'A horizon needs an agreed observable first: collapse flux, focus sensitivity, or another local-first statistic.'
    }),
    pending({
      id: 'atlas',
      section: 'Parameters',
      title: 'Parameter-space slices should reveal a stability atlas',
      note: 'There is no parameterized micro-rule family yet, so Mandelbrot- or Feigenbaum-like claims remain deliberately outside the exact set.'
    })
  ]

const countStatuses = claims =>
  claims.reduce(
    (counts, claim) => ({
      ...counts,
      [claim.status]: (counts[claim.status] || 0) + 1
    }),
    {})

export const runProofs = () => {
  const exactResults = exactClaims()
  const pendingResults = pendingClaims()
  const claims = [...exactResults, ...pendingResults]
  const exactCounts = countStatuses(exactResults)
  const pendingCounts = countStatuses(pendingResults)

  return {
    maxPairs: MAX_PAIRS,
    claims,
    exact: exactResults,
    pending: pendingResults,
    summary: {
      exact: {
        total: exactResults.length,
        pass: exactCounts.pass || 0,
        fail: exactCounts.fail || 0
      },
      pending: {
        total: pendingResults.length,
        pending: pendingCounts.pending || 0
      }
    }
  }
}
