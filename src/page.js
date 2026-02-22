import { a, article, aside, component, div, li, main, nav, section, summary,
         ul } from '@pfern/elements'
import { createMarkdown, runMarkdownScriptsForBasePath } from './markdown.js'
import { content, getActiveItem, getActiveRoute }
  from './utils/site-content.js'
import { loadMarkdownText, loadScriptDefault } from './utils/content-loaders.js'

// Route → content caches.
//
// - `cache`: resolved module/text (or an error fallback)
// - `inflight`: ongoing loads, with optional callbacks to rerender when done
// - `keepAlive*`: vnodes for JS routes that should persist across navigation
const cache = {}
const inflight = {}
const keepAliveVisited = {}
const keepAliveVNodes = {}
const markdownRenderers = {}
let prevActiveRoute = null
const defer =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : fn => Promise.resolve().then(fn)

const subscribeInflight = (path, fn) => {
  const entry = inflight[path]
  if (!entry) return false
  entry.notify.add(fn)
  return true
}

const loadMarkdown = path => {
  if (cache[path]) return
  if (subscribeInflight(path, page)) return

  inflight[path] = { notify: new Set([page]) }

  loadMarkdownText(path)
    .then(text => cache[path] = text)
    .catch(error =>
      cache[path] = (() => {
        const msg = String(error?.message || error)
        return msg.startsWith('Missing markdown module:')
          ? `# Not found\n\n${msg}`
          : msg
      })())
    .finally(() => {
      const notify = inflight[path]?.notify || new Set()
      delete inflight[path]
      notify.forEach(fn => fn())
    })
}

const loadScript = path => {
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
      cache[path] = () => article(String(error?.message || error)))
    .finally(() => {
      const notify = inflight[path]?.notify || new Set()
      delete inflight[path]
      notify.forEach(fn => fn())
    })
}

const renderMarkdownItem = item => {
  const path = item.localPath
  return cache[path]
    ? article((markdownRenderers[path] ||= createMarkdown())(
      cache[path], { basePath: path }))
    : (loadMarkdown(path), article('Loading…'))
}

const renderJsItem = item => {
  const path = item.localPath
  return cache[path]
    ? cache[path]()
    : (loadScript(path), article('Loading…'))
}

const renderKeepAliveItems = (activeRoute, { active = false } = {}) => {
  const nodes = []
  for (const group of content) {
    for (const item of group.items) {
      if (!item.keepAlive) continue
      const isJs = item.localPath.endsWith('.js')
      const isMd = item.localPath.endsWith('.md')
      if (!isJs && !isMd) continue
      if (!keepAliveVisited[item.localPath]) continue

      const vnode = keepAliveVNodes[item.localPath]
        || (cache[item.localPath]
          ? keepAliveVNodes[item.localPath] ||= (
            isJs
              ? cache[item.localPath]()
              : article((markdownRenderers[item.localPath] ||= createMarkdown())(
                cache[item.localPath], { basePath: item.localPath }))
          )
          : (isJs
            ? (loadScript(item.localPath), article('Loading…'))
            : (loadMarkdown(item.localPath), article('Loading…'))))

      const isActive = item.publicPath === activeRoute
      nodes.push(
        section(
          { 'data-active': isActive ? 'true' : 'false',
            'aria-hidden': isActive ? 'false' : 'true',
            inert: !isActive },
          vnode))
    }
  }
  return nodes.length
    ? section(
      { class: 'keep-alive',
        'data-active': active ? 'true' : 'false',
        'aria-hidden': active ? 'false' : 'true',
        inert: !active },
      ...nodes)
    : null
}

export const page = component(
  () => {
    const activeRoute = getActiveRoute(window.location.pathname)
    const activeItem = getActiveItem(window.location.pathname)
    const isKeepAliveActive =
      !!activeItem?.keepAlive
      && (activeItem.localPath?.endsWith('.js')
        || activeItem.localPath?.endsWith('.md'))

    isKeepAliveActive && (keepAliveVisited[activeItem.localPath] = true)

    // When activating a keep-alive markdown route, make sure any extracted
    // markdown scripts that didn't get a chance to run (e.g. due to rerenders)
    // are executed, and nudge X3DOM/visualizations to resize.
    if (activeRoute !== prevActiveRoute) {
      prevActiveRoute = activeRoute
      if (activeItem?.keepAlive && activeItem.localPath?.endsWith?.('.md')) {
        defer(() => {
          runMarkdownScriptsForBasePath(activeItem.localPath)
          try { window.dispatchEvent(new Event('resize')) } catch {}
        })
      }
    }

    const keepAlive = renderKeepAliveItems(
      activeRoute, { active: isKeepAliveActive })

    const activeNode =
      activeItem?.localPath?.endsWith('.md')
        ? activeItem.keepAlive
          ? null
          : renderMarkdownItem(activeItem)
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
                      ul(...group.items.map(({ label, publicPath }) => {
                        const href = publicPath
                        const isActive = href === activeRoute
                        const props = { href, class: isActive ? 'active' : '' }
                        isActive && (props['aria-current'] = 'page')
                        return li(a(props, label))
                      })))))),
                div({ class: 'content' }, activeNode, keepAlive))
  })
