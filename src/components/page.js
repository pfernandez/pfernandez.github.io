import { a, article, aside,
         component, li, main, nav, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'

const pages = [
  'home.md',
  'test.md',
]

const slugFromName = name => name.replace(/\.md$/, '')

const pathFromName = name => {
  const slug = slugFromName(name)
  return `/md/${slug}`
}

const nameFromPath = (path = '/') => {
  if (path === '/' || path === '') return 'home.md'
  const match = path.match(/^\/md\/([^/?#]+)\/?$/)
  if (!match) return null
  const slug = match[1]
  const name = `${slug}.md`
  return pages.includes(name) ? name : null
}

const currentName = () => {
  if (typeof window === 'undefined') return 'home.md'
  return nameFromPath(window.location.pathname) || 'home.md'
}

const navigate = (name, { force = false } = {}) => {
  if (typeof window === 'undefined') return
  if (!force && window.location.pathname === '/' && name === 'home.md') return
  const nextPath = pathFromName(name)
  if (window.location.pathname !== nextPath) {
    window.history.pushState({}, '', nextPath)
  }
}

export const page = component(
  (name = currentName(), text = '') => {
    const links = name => ul(
      ...pages.map(s => li(
        a({
          href: pathFromName(s),
          class: s === name ? 'active': '',
          onclick: event => {
            event?.preventDefault?.()
            navigate(s, { force: true })
            return page(s)
          } },
          s.split('.')[0]))))

    const content = (name, text) =>
      main({ class: 'grid' },
        aside(
          nav(
            summary('Posts'),  // Wrap with `details()` to
            links(name))),     // expand/collapse with pico.css.
        article(markdown(text)))

    !text.length && fetch(`${import.meta.env.BASE_URL}md/${name}`)
      .then(res => res.text())
      .then(res => page(name, res))

    navigate(name)

    return content(name, text || 'Loading...')})

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => page(currentName()))
}
