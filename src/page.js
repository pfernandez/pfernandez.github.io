import config from './pages/config.js'
import { a, article, aside, component, li, main, nav,
         section, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'

const basePath = '/src/pages'
const cache = {}
const inflight = {}
const keepAliveVisited = {}
const keepAliveVNodes = {}

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
      return page(route)
    })
    .catch(error =>
      (cache[path] = String(error?.message || error), page(route)))
    .finally(() => delete inflight[path])
}

const loadScript = (route, path) => {
  if (cache[path] || inflight[path]) return
  inflight[path] = import(/* @vite-ignore */ path)
    .then(module => (
      cache[path] = module.default,
      keepAliveVisited[path]
        && (keepAliveVNodes[path] ||= cache[path]()),
      page(route)))
    .catch(error =>
      (cache[path] = () => article(String(error?.message || error)), page(route)))
    .finally(() => delete inflight[path])
}

const renderMarkdownItem = item => {
  const path = item.localPath
  return cache[path]
    ? article(markdown(cache[path]))
    : (loadMarkdown(item.publicPath, path), article('Loading…'))
}

const renderJsItem = item => {
  const path = item.localPath
  return cache[path]
    ? cache[path]()
    : (loadScript(item.publicPath, path), article('Loading…'))
}

const renderKeepAliveItems = (activeRoute, { active = false } = {}) => {
  /** @type {any[]} */
  const nodes = []
  for (const group of content) {
    for (const item of group.items) {
      if (!item.keepAlive) continue
      if (!item.localPath.endsWith('.js')) continue
      if (!keepAliveVisited[item.localPath]) continue

      const vnode = keepAliveVNodes[item.localPath]
        || (cache[item.localPath]
          ? (keepAliveVNodes[item.localPath] ||= cache[item.localPath]())
          : (loadScript(item.publicPath, item.localPath), article('Loading…')))

      const isActive = item.publicPath === activeRoute
      nodes.push(
        section(
          { 'data-active': isActive ? 'true' : 'false',
            'aria-hidden': isActive ? 'false' : 'true' },
          vnode
        )
      )
    }
  }
  return nodes.length
    ? section(
      { class: 'keep-alive',
        'data-active': active ? 'true' : 'false',
        'aria-hidden': active ? 'false' : 'true' },
      ...nodes
    )
    : null
}

export const page = component(
  (route = window.location.pathname) => {
    const currentRoute = normalizeRoute(window.location.pathname)
    const activeRoute =
      currentRoute === '/'
        ? findDefaultItem()?.publicPath || '/'
        : currentRoute

    const activeItem = findItemByRoute(activeRoute) || findDefaultItem()
    const isKeepAliveActive =
      !!activeItem?.keepAlive && activeItem.localPath?.endsWith('.js')

    isKeepAliveActive && (keepAliveVisited[activeItem.localPath] = true)

    const keepAlive = renderKeepAliveItems(activeRoute, { active: isKeepAliveActive })

    const activeNode =
      activeItem?.localPath?.endsWith('.md')
        ? renderMarkdownItem(activeItem)
        : activeItem?.localPath?.endsWith('.js')
          ? activeItem.keepAlive
            ? null
            : renderJsItem(activeItem)
          : article('Not found.')

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

         section({ class: 'content' }, activeNode, keepAlive))
  })
