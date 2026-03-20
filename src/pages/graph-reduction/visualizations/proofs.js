import { article, code, div, h2, h3, p, section, span } from '@pfern/elements'
import { runProofs } from '../proofs/index.js'
import './proofs.css'

const badgeClass = status =>
  ({ pass: 'proofs-badge proofs-badge-pass',
     fail: 'proofs-badge proofs-badge-fail',
     pending: 'proofs-badge proofs-badge-pending' }[status])

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

const claimCard = claim =>
  div(
    { class: 'proofs-card' },
    div(
      { class: 'proofs-card-head' },
      div(
        h3(claim.title),
        p({ class: 'proofs-meta' }, claim.section)
      ),
      span({ class: badgeClass(claim.status) }, label(claim.status))
    ),
    p(claim.note)
  )

const claimSection = (title, claims) =>
  section(
    h2(title),
    div(
      { class: 'proofs-grid' },
      ...bySection(claims).map(group =>
        div(
          { class: 'proofs-panel' },
          h3(group.name),
          div({ class: 'proofs-grid' }, ...group.claims.map(claimCard))
        ))
    )
  )

export default () => {
  const proofs = runProofs()

  return article(
    section(
      { class: 'proofs-page' },
      div(
        { class: 'proofs-panel proofs-intro' },
        h2('Proofs'),
        p(
          'This page keeps the notebook honest. The exact claims below run directly against the current collapse kernel, and the same runner is available in the terminal with ',
          code('npm run proofs'),
          '.'
        ),
        p(
          'Anything more ambitious stays visible, but explicitly pending, until the program has the right machinery to carry it.'
        )
      ),
      div(
        { class: 'proofs-summary' },
        div(
          { class: 'proofs-panel' },
          h3('Exact'),
          p(
            `${proofs.summary.exact.pass}/${proofs.summary.exact.total} passing`
          )
        ),
        div(
          { class: 'proofs-panel' },
          h3('Pending'),
          p(
            `${proofs.summary.pending.pending}/${proofs.summary.pending.total} waiting for new machinery`
          )
        ),
        div(
          { class: 'proofs-panel' },
          h3('Scope'),
          p(`Pure Catalan pairs up to ${proofs.maxPairs} pair nodes`)
        )
      ),
      claimSection('Exact Claims', proofs.exact),
      claimSection('Planned Claims', proofs.pending)
    )
  )
}
