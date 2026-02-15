import { a, article, aside, component, li, main, nav,
         section, summary, ul } from '@pfern/elements'
import { markdown } from './markdown.js'
import { content, getActiveRoute, getActiveItem }
  from './utils/site-content.js'
import { loadMarkdownText, loadScriptDefault }
  from './utils/content-loaders.js'

// Route → content caches.
//
// - `cache`: resolved module/text (or an error fallback)
// - `inflight`: ongoing loads, with optional callbacks to rerender when done
// - `keepAlive*`: vnodes for JS routes that should persist across navigation
const cache = {}
const inflight = {}
const keepAliveVisited = {}
const keepAliveVNodes = {}

const subscribeInflight = (path, fn) => {
  const entry = inflight[path]
  if (!entry) return false
  entry.notify.add(fn)
  return true
}

const loadMarkdown = (route, path) => {
  if (cache[path]) return
  if (subscribeInflight(path, page)) return

  inflight[path] = { notify: new Set([page]) }

  loadMarkdownText(path)
    .then(text => (cache[path] = text))
    .catch(error =>
      (cache[path] = String(error?.message || error)))
    .finally(() => {
      const notify = inflight[path]?.notify || new Set()
      delete inflight[path]
      notify.forEach(fn => fn())
    })
}

const loadScript = (route, path) => {
  if (cache[path]) return
  if (subscribeInflight(path, page)) return

  inflight[path] = { notify: new Set([page]) }

  loadScriptDefault(path)
    .then(defaultExport => {
      cache[path] = defaultExport
      keepAliveVisited[path]
        && (keepAliveVNodes[path] ||= cache[path]())
    })
    .catch(error =>
      (cache[path] = () => article(String(error?.message || error))))
    .finally(() => {
      const notify = inflight[path]?.notify || new Set()
      delete inflight[path]
      notify.forEach(fn => fn())
    })
}

const prefetchItem = item => {
  if (!item?.localPath) return
  item.localPath.endsWith('.md')
    ? loadMarkdown(item.publicPath, item.localPath)
    : item.localPath.endsWith('.js')
      ? loadScript(item.publicPath, item.localPath)
      : undefined
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
            'aria-hidden': isActive ? 'false' : 'true',
            inert: !isActive },
          vnode
        )
      )
    }
  }
  return nodes.length
    ? section(
      { class: 'keep-alive',
        'data-active': active ? 'true' : 'false',
        'aria-hidden': active ? 'false' : 'true',
        inert: !active },
      ...nodes
    )
    : null
}

export const page = component(
  (route = window.location.pathname) => {
    const activeRoute = getActiveRoute(window.location.pathname)
    const activeItem = getActiveItem(window.location.pathname)
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
                 const props = {
                   href,
                   class: isActive ? 'active' : '',
                   onmouseenter: () => prefetchItem(item),
                   onfocus: () => prefetchItem(item)
                 }
                 isActive && (props['aria-current'] = 'page')
                 return li(
                   a(props, item.label)) })))))),

         section({ class: 'content' }, activeNode, keepAlive))
  })
