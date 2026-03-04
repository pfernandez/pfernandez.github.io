import { a, article, component, div, h1, h2, header, input, label, li, main,
         nav, section, span, ul } from '@pfern/elements'
import { createMarkdown, runMarkdownScriptsForBasePath } from './markdown.js'
import { content, getActiveItem, getActiveRoute } from './utils/site-content.js'
import { loadMarkdownText, loadScriptDefault } from './utils/content-loaders.js'
import config from './pages/config.js'

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
    ? window.queueMicrotask
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

// Keep-alive slots must be rendered in a stable order from the start.
// Elements.js diffs children by index; inserting new keep-alive sections later
// would remount earlier ones (causing X3DOM canvases to "reload").
const keepAliveItems = content
  .flatMap(group => group.items)
  .filter(item =>
    !!item.keepAlive
    && (item.localPath.endsWith('.js') || item.localPath.endsWith('.md')))

const renderKeepAliveItems = (activeRoute, { active = false } = {}) => {
  const nodes = []
  for (const item of keepAliveItems) {
    const isJs = item.localPath.endsWith('.js')
    const isActive = item.publicPath === activeRoute
    const shouldRender = isActive || !!keepAliveVisited[item.localPath]

    const vnode = !shouldRender
      ? null
      : keepAliveVNodes[item.localPath]
        || (cache[item.localPath]
          ? keepAliveVNodes[item.localPath]
            ||= isJs
              ? cache[item.localPath]()
              : article(
                (markdownRenderers[item.localPath] ||= createMarkdown())(
                  cache[item.localPath], { basePath: item.localPath }))
          : isJs
            ? (loadScript(item.localPath), article('Loading…'))
            : (loadMarkdown(item.localPath), article('Loading…')))

    nodes.push(
      section({ 'data-active': isActive ? 'true' : 'false',
                'aria-hidden': isActive ? 'false' : 'true',
                inert: !isActive },
              vnode))
  }
  return nodes.length
    ? section({ class: 'keep-alive',
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

    const keepAlive = renderKeepAliveItems(activeRoute,
                                           { active: isKeepAliveActive })

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

    return main(
      div({ id: 'sidebar',
            onclick: event => {
              const anchor = event.target?.closest?.('a')
              if (!anchor) return
              const toggle =
                event.currentTarget?.querySelector?.('input[type="checkbox"][data-sidebar-toggle]')
              if (!toggle) return
              toggle.checked = false
              delete event.currentTarget.dataset.sidebarOpen
            } },
          label({ class: 'toggle' },
                input({ type: 'checkbox', 'data-sidebar-toggle': '1' }),
                span({ class: 'icon' }, '☰'),
                span({ class: 'hidden' }, 'Toggle Menu')),
          div({ class: 'sidebar-panel' },
              header(
                h1(config.title)),
              nav(...content.map(group =>
                section(
                  h2(group.summary),
                  ul(...group.items.map(({ label, publicPath }) => {
                    const href = publicPath
                    const isActive = href === activeRoute
                    const props = { href, class: isActive ? 'active' : '' }
                    isActive && (props['aria-current'] = 'page')
                    return li(a(props, label))
                  }))))))),
      div({ id: 'content' }, activeNode, keepAlive))
  })
