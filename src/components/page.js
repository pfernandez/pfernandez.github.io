import { a, article, aside,
         component, li, main, navigate, nav, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'

const pages = [
  'home.md',
  'test.md',
]

const pathFromName = name =>
  `/md/${ name.replace(/\.md$/, '')}`

const nameFromPath = (path = '/') => {
  if (path === '/' || path === '') return 'home.md'
  const slug = path.match(/^\/md\/([^/?#]+)\/?$/)?.[1]
  if (!slug) return null
  const name = `${slug}.md`
  return pages.includes(name) ? name : null
}

const currentName = () =>
  (typeof window === 'undefined')
    ? 'home.md'
    : nameFromPath(window.location.pathname) || 'home.md'

const syncUrl = (name, { force = false } = {}) => {
  if (typeof window === 'undefined') return
  if (!force && window.location.pathname === '/' && name === 'home.md') return
  navigate(pathFromName(name), { force })
}

let lastFetchToken = 0

const mdUrl = name =>
  `${import.meta.env.BASE_URL}md/${name}`

const loadMarkdown = name => {
  const token = ++lastFetchToken

  fetch(mdUrl(name))
    .then(res => {
      const contentType = res.headers?.get?.('content-type') || ''
      const isHtml = contentType.includes('text/html')
      if (!res.ok || isHtml) throw new Error(`Failed to load ${name}`)
      return res.text()
    })
    .then(text => (token === lastFetchToken) && page(name, text))
    .catch(() => (token === lastFetchToken) && page(
      name,
      `# Not found\n\nMissing: \`${name}\`\n`
    ))
}

export const page = component(
  (name = currentName(), text = '') => {
    const links = name => ul(
      ...pages.map(s => li(
        a({
          href: pathFromName(s),
          class: s === name ? 'active' : '',
          onclick: event => {
            event?.preventDefault?.()
            syncUrl(s, { force: true })
            return page(s)
          } },
          s.split('.')[0]))))

    const content = (name, text) =>
      main({ class: 'grid' },
        aside(
          nav(
            summary('Posts'),
            links(name))),
        article(markdown(text)))

    !text.length && loadMarkdown(name)

    syncUrl(name)

    return content(name, text || 'Loading...')
  })

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => page(currentName()))
}
