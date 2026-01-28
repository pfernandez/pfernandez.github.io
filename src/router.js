import { config } from './config.js'

const toKebab = value =>
  value
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const postsLabel = config.pages.posts.summary
export const postsSegment = toKebab(postsLabel)

export const pages = [
  ...config.pages.posts.links,
  ...config.pages.extras
]

export const pathFromName = name =>
  name.endsWith('.md')
    ? name === 'home.md'
      ? '/'
      : `/${postsSegment}/${name.replace(/\.md$/, '')}`
    : `/${name}`

export const routes = pages.map(pathFromName)

export const navigate = (path, { replace = false, force = false } = {}) => {
  if (typeof window === 'undefined') return

  const url = new URL(path, window.location.origin)
  const isSame =
    url.pathname === window.location.pathname
    && url.search === window.location.search
    && url.hash === window.location.hash

  if (!force && isSame) return

  const fn = replace ? 'replaceState' : 'pushState'
  window.history[fn]({}, '', url)

  try {
    window.dispatchEvent(new PopStateEvent('popstate'))
  } catch {
    window.dispatchEvent(new Event('popstate'))
  }
}

export const currentPath = () =>
  typeof window === 'undefined'
    ? '/'
    : window.location.pathname || '/'

export const normalizePath = (path = '/') =>
  routes.includes(path) ? path : '/'

export const go = (path, { force = false } = {}) => {
  const next = normalizePath(path)
  navigate(next, { force })
  return next
}

export const nameFromPath = (path = '/') => {
  const normalized = normalizePath(path)
  if (normalized === '/') return 'home.md'
  const mdSlug = normalized.match(new RegExp(`^\\/${postsSegment}\\/([^/?#]+)\\/?$`))?.[1]
  if (mdSlug) {
    const name = `${mdSlug}.md`
    return pages.includes(name) ? name : null
  }
  const direct = normalized.replace(/^\/+/, '').replace(/\/+$/, '')
  return pages.includes(direct) ? direct : null
}

export const currentName = () =>
  nameFromPath(currentPath()) || 'home.md'
