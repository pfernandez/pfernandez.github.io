/** Flatten the authored navigation groups into their page entries. */
export const pages = groups => groups.flatMap(group => group.items)

export const normalizeRoute = route =>
  route === '/' ? '/' : String(route || '').replace(/\/+$/, '')

export const activeRoute = (pages, route) => {
  const current = normalizeRoute(route)
  return current === '/'
    ? pages.find(page => page.default)?.route ?? '/'
    : current
}

export const currentPage = (pages, route) => {
  const current = activeRoute(pages, route)
  return pages.find(page => page.route === current)
    ?? pages.find(page => page.default)
}

export const currentRoute = () =>
  globalThis.window?.location.pathname ?? '/'
