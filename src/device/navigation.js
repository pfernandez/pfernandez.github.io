import { elements } from '@pfern/elements'
import config from '../pages/config.js'

/** Route configuration and the temporary browser-navigation capability. */
export const groups = config.pages
export const pages = groups.flatMap(group => group.items)

export const normalizeRoute = route =>
  route === '/' ? '/' : String(route || '').replace(/\/+$/, '')

export const activeRoute = route => {
  const current = normalizeRoute(route)
  return current === '/'
    ? pages.find(page => page.default)?.route ?? '/'
    : current
}

export const currentPage = route => {
  const current = activeRoute(route)
  return pages.find(page => page.route === current)
    ?? pages.find(page => page.default)
}

export const currentRoute = () =>
  globalThis.window?.location.pathname ?? '/'

export const navigation = ({ values }) => {
  const current = activeRoute(values()[0])

  return elements.nav(...groups.map(group =>
    elements.section(
      elements.h2(group.summary),
      elements.ul(...group.items.map(item => {
        const active = item.route === current
        const props = {
          href: item.route,
          class: active ? 'active' : ''
        }
        if (active) props['aria-current'] = 'page'
        return elements.li(elements.a(props, item.label))
      })))))
}
