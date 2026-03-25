import { article, code, div, h2, h3, h4, p, section, span } from '@pfern/elements'
import { runProofs } from '../proofs/index.js'
import './style.css'

const badgeClass = status =>
  ({ pass: 'proofs-badge pass',
     fail: 'proofs-badge fail',
     pending: 'proofs-badge pending' }[status])

const label = status =>
  ({ pass: 'Pass', fail: 'Fail', pending: 'Pending' }[status])

const bySection = claims =>
  claims.reduce((sections, claim) => {
    const section = sections.find(entry => entry.name === claim.section)
    if (section) {
      section.claims.push(claim)
      return sections
    }

    return [...sections, { name: claim.section, claims: [claim]}]
  }, [])

const claim = claim =>
  div(
    { class: 'proof' },
    h4(
      claim.title,
      ' ',
      span({ class: badgeClass(claim.status) }, label(claim.status))
    ),
    p({ class: 'proofs-meta' }, claim.section),
    p(claim.note)
  )

const claimSection = (title, claims) =>
  section(
    h2(title),
    ...bySection(claims).flatMap(group =>
      [h3(group.name), ...group.claims.map(claim)])
  )

export default () => {
  const proofs = runProofs()

  return article(
    { class: 'proofs-page' },
    h2('Proofs'),
    p(
      'This page keeps the notebook honest. The exact claims below run directly against the current collapse kernel, and the same runner is available in the terminal with ',
      code('npm run proofs'),
      '.'
    ),
    p(
      'Anything more ambitious stays visible, but explicitly pending, until the program has the right machinery to carry it.'
    ),
    section(
      h3('Summary'),
      p(`${proofs.summary.exact.pass}/${proofs.summary.exact.total} exact claims passing.`),
      p(`${proofs.summary.pending.pending}/${proofs.summary.pending.total} claims still pending new machinery.`),
      p(`Scope: pure Catalan pairs up to ${proofs.maxPairs} pair nodes.`)
    ),
    claimSection('Exact Claims', proofs.exact),
    claimSection('Planned Claims', proofs.pending)
  )
}
