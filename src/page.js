import config from './pages/config.js'
import { a, article, aside, component, li, main, nav,
         section, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'

const basePath = '/src/pages'
const pageTypes = { MARKDOWN: 'markdown', JAVASCRIPT: 'javascript' }
const cache = {}
const inflight = {}

const stripExtension = path => path.replace(/\.[^/.]+$/, '')
const stripSlash = path => path.replace(/^\/+/, '').replace(/\/+$/, '')
const commonPath = (path, file) => `/${stripSlash(path)}/${stripSlash(file)}`
const publicPath = (path, file) => stripExtension(commonPath(path, file))
const localPath = (path, file) => `${basePath}${commonPath(path, file)}`
const normalizeRoute = route =>
  route === '/' ? '/' : String(route || '').replace(/\/+$/, '')

const content = config.pages.reduce((content, section) =>
  [...content,
   { ...section,
     items: section.items.map(item =>
       ({ ...item,
          publicPath: publicPath(section.path, item.file),
          localPath: localPath(section.path, item.file) })) }], [])

const findItemByRoute = route => {
  const normalized = normalizeRoute(route)
  for (const group of content) {
    for (const item of group.items) {
      if (item.publicPath === normalized) return item
    }
  }
  return null
}

const findDefaultItem = () => {
  for (const group of content) {
    for (const item of group.items) {
      if (item.default) return item
    }
  }
  return content?.[0]?.items?.[0] || null
}

const loadMarkdown = (route, path) => {
  if (cache[path] || inflight[path]) return
  inflight[path] = fetch(path)
    .then(res => {
      const contentType = res.headers?.get?.('content-type') || ''
      const isHtml = contentType.includes('text/html')
      if (!res.ok || isHtml) throw new Error(`Failed to load ${path}`)
      return res.text()
    }).then(text => {
      cache[path] = text
      return page(route, { type: pageTypes.MARKDOWN, text })
    })
    .catch(error =>
      page(route, { type: pageTypes.MARKDOWN,
                   text: String(error?.message || error) }))
    .finally(() => delete inflight[path])
}

const loadScript = (route, path) => {
  if (cache[path] || inflight[path]) return
  inflight[path] = import(/* @vite-ignore */ path)
    .then(module => (
      cache[path] = module.default,
      page(route, { type: pageTypes.JAVASCRIPT, js: cache[path] })))
    .catch(error =>
      page(route, { type: pageTypes.JAVASCRIPT,
                   text: String(error?.message || error) }))
    .finally(() => delete inflight[path])
}

const loadContent = route => {
  const normalized = normalizeRoute(route)
  const item =
    findItemByRoute(normalized)
    || (normalized === '/' ? findDefaultItem() : null)

  if (!item) return article('Not found.')

  const path = item.localPath

  return path.endsWith('.md')
    ? (cache[path] ? article(markdown(cache[path]))
      : (loadMarkdown(item.publicPath, path), article('Loading…')))
    : path.endsWith('.js')
      ? (cache[path] ? cache[path]()
        : (loadScript(item.publicPath, path), article('Loading…')))
      : article('Unsupported page type.')
}

export const page = component(
  (route = window.location.pathname, { js, text, type } = {}) => {
    const currentRoute = normalizeRoute(window.location.pathname)
    const activeRoute =
      currentRoute === '/'
        ? findDefaultItem()?.publicPath || '/'
        : currentRoute

         return main({ class: 'grid' },
         aside(
           nav(...content.map(group =>
             section(
               summary(group.summary),

               ul(...group.items.map(item => {
                 const href = item.publicPath
                 const isActive = href === activeRoute
                 return li(
                   a({ href, class: isActive ? 'active' : '',
                     },
                     item.label)) })))))),

         type === pageTypes.MARKDOWN
           ? article(typeof text === 'string' ? markdown(text) : text)
           : type === pageTypes.JAVASCRIPT
             ? (typeof js === 'function' ? js() : article(text))
             : loadContent(route))
  })
