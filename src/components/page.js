import { config } from '../config.js'
import { a, article, aside, component, li,
         main, nav, navigate, summary, ul } from '@pfern/elements'
import { vis3d } from './vis3d.js'
import { markdown } from './markdown.js'

const toKebab = value =>
  value.toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const postsLabel = config.pages.posts.summary
export const postsSegment = toKebab(postsLabel)
export const pages = [...config.pages.posts.links, ...config.pages.extras]

export const pathFromName = name =>
  name.endsWith('.md')
    ? name === 'home.md'
      ? '/'
      : `/${postsSegment}/${name.replace(/\.md$/, '')}`
    : `/${name}`

export const routes = pages.map(pathFromName)

// @ts-ignore
const mdUrl = name => `${import.meta.env.BASE_URL}${postsSegment}/${name}`

export const currentName = (path = window.location.pathname) => {
  const normalized = routes.includes(path) ? path : '/'

  const mdSlug = normalized.match(
    new RegExp(`^\\/${postsSegment}\\/([^/?#]+)\\/?$`))?.[1]
  if (mdSlug) {
    const name = `${mdSlug}.md`
    return pages.includes(name) ? name : null
  }

  const direct = normalized.replace(/^\/+/, '').replace(/\/+$/, '')
  return pages.includes(direct) ? direct : 'home.md'
}

let lastFetchToken = 0

const loadMarkdown = name => {
  if (name.endsWith('.md')) {
    const token = ++lastFetchToken

    fetch(mdUrl(name))
      .then(res => {
        const contentType = res.headers?.get?.('content-type') || ''
        const isHtml = contentType.includes('text/html')
        if (!res.ok || isHtml) throw new Error(`Failed to load ${name}`)
        return res.text()
      })
      .then(text => token === lastFetchToken && page(name, text))
      .catch(() => token === lastFetchToken
        && page(name, `# Not found\n\nMissing: \`${name}\`\n`))
  }}

export const page = component(
  (name = currentName(), text = '') => {

    const links = name => ul(
      ...pages.map(s => li(
        a({ href: pathFromName(s),
            class: s === name ? 'active' : '',
            onclick: event => {
              event?.preventDefault?.()
              navigate(pathFromName(s))
              return page(s)
            } },
          s.split('.')[0]))))

    const content = (name, text) =>
      main({ class: 'grid' },
           aside(
             nav(
               summary(postsLabel),
               links(name))),
           article(name.endsWith('.md') ? markdown(text) : vis3d()))

    !text.length && loadMarkdown(name)

    return content(name, text || 'Loading...')
  })

window?.addEventListener('popstate', () => page(currentName()))
