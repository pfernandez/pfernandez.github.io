import config from './pages/config.js'
import { a, article, aside, component, li, main, nav,
         navigate, section, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'

const basePath = '/src/pages'
const pageTypes = { MARKDOWN: 'markdown', JAVASCRIPT: 'javascript' }
const cache = {}

const stripExtension = path => path.replace(/\.[^/.]+$/, '')
const stripSlash = path => path.replace(/^\/+/, '').replace(/\/+$/, '')
const commonPath = (path, file) => `/${stripSlash(path)}/${stripSlash(file)}`
const publicPath = (path, file) => stripExtension(commonPath(path, file))
const localPath = (path, file) => `${basePath}${commonPath(path, file)}`

const content = config.pages.reduce((content, section) =>
  [...content,
   { ...section,
     items: section.items.map(item =>
       ({ ...item,
          publicPath: publicPath(section.path, item.file),
          localPath: localPath(section.path, item.file) })) }], [])

const loadMarkdown = path =>
  cache[path] ? null : fetch(path)
    .then(res => {
      const contentType = res.headers?.get?.('content-type') || ''
      const isHtml = contentType.includes('text/html')
      if (!res.ok || isHtml) throw new Error(`Failed to load ${path}`)
      return res.text()
    }).then(text => {
      cache[path] = markdown(text)
      return page(path, { type: pageTypes.MARKDOWN, text: cache[path] })
    })
    .catch(error => page(path, { type: pageTypes.MARKDOWN, text: error }))

const loadScript = path =>
  cache[path] ? null
    : import(/* @vite-ignore */ path)
      .then(module => (
        cache[path] = module.default,
        page(path, { type: pageTypes.JAVASCRIPT, js: cache[path] })))
      .catch(err => console.error('Module loading failed:', err))

const loadContent = (route, text) => {
  let path = '/'
  content.some(section =>
    section.items.some(item =>
      item.publicPath === route && (path = item.localPath)))

  path.endsWith('.md') && !text
    ? loadMarkdown(path)
    : path.endsWith('.js') && loadScript(path) }

export const page = component(
  (path = window.location.pathname, { js, label, text, type } = {}) =>
    main({ class: 'grid' },
         aside(
           nav(...content.map(group =>
             section(
               summary(group.summary),

               ul(...group.items.map(item => {
                 const href = publicPath(group.path, item.file)
                 return li(
                   a({ href, class: label === item.label ? 'active' : '',
                       onclick: () => {
                         // navigate(href)
                         // FIXME: Page reloads; page element should be replaced
                         // instead. See `counter` example in elements package.
                         return page(href, item.label)
                       } },
                     item.label)) })))))),

         text && type === pageTypes.MARKDOWN
           ? article(text)
           : type === pageTypes.JAVASCRIPT
             ? js()
             : text || loadContent(path)))

window?.addEventListener('popstate', () => page())

