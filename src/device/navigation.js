import config from '../pages/config.js'

/** Route configuration used only to choose the initial page continuation. */
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
