import { a, article, aside,
         component, li, main, nav, summary, ul } from '@pfern/elements'
import { currentName, go, pages,
         pathFromName, postsLabel, postsSegment } from '../router.js'
import { markdown } from './markdown.js'
import { vis3d } from './vis3d.js'

let lastFetchToken = 0

// @ts-ignore
const mdUrl = name => `${import.meta.env.BASE_URL}${postsSegment}/${name}`

const loadMarkdown = name => {
  if (!name.endsWith('.md')) return
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
      `# Not found\n\nMissing: \`${name}\`\n`))
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
            go(pathFromName(s), { force: true })
            return page(s)
          } },
          s.split('.')[0]))))

    const content = (name, text) =>
      main({ class: 'grid' },
        aside(
          nav(
            summary(postsLabel),
            links(name))),
        name === '3d'
          ? vis3d()
          : article(markdown(text)))

    !text.length && loadMarkdown(name)

    if (name === '3d' && typeof window !== 'undefined') {
      // @ts-ignore
      requestAnimationFrame(() => window?.x3dom?.reload?.())
    }

    return content(name, text || 'Loading...')
  })

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => page(currentName()))
}
