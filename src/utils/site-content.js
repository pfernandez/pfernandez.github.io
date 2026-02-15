// Site content model derived from `src/pages/config.js`.
//
// This module centralizes all route/path normalization so the view layer
// (`src/page.js`) stays focused on rendering + caching.

import config from '../pages/config.js'

const basePath = '/src/pages'

const stripExtension = path => path.replace(/\.[^/.]+$/, '')
const stripSlash = path => path.replace(/^\/+/, '').replace(/\/+$/, '')
const commonPath = (path, file) => `/${stripSlash(path)}/${stripSlash(file)}`

const publicPath = (path, file) => stripExtension(commonPath(path, file))
const localPath = (path, file) => `${basePath}${commonPath(path, file)}`

export const normalizeRoute = route =>
  route === '/' ? '/' : String(route || '').replace(/\/+$/, '')

export const content = config.pages.reduce((acc, section) =>
  [...acc,
   { ...section,
     items: section.items.map(item =>
       ({ ...item,
          publicPath: publicPath(section.path, item.file),
          localPath: localPath(section.path, item.file) })) }], [])

export const findItemByRoute = route => {
  const normalized = normalizeRoute(route)
  for (const group of content) {
    for (const item of group.items) {
      if (item.publicPath === normalized) return item
    }
  }
  return null
}

export const findDefaultItem = () => {
  for (const group of content) {
    for (const item of group.items) {
      if (item.default) return item
    }
  }
  return content?.[0]?.items?.[0] || null
}

export const getActiveRoute = route => {
  const currentRoute = normalizeRoute(route)
  return currentRoute === '/'
    ? findDefaultItem()?.publicPath || '/'
    : currentRoute
}

export const getActiveItem = route =>
  findItemByRoute(getActiveRoute(route)) || findDefaultItem()

