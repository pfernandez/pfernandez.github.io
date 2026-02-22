// Dev-only config validation.
//
// This keeps routing issues obvious early (duplicate routes, multiple defaults)
// without adding runtime complexity in production.

const summarize = item =>
  `${item?.label || '(unlabeled)'} (${item?.file || 'no file'})`

export const validateConfig = config => {
  const pages = config?.pages || []
  const routes = new Map()
  let defaultCount = 0

  for (const section of pages) {
    const path = String(section?.path || '').replace(/^\/+|\/+$/g, '')
    const items = section?.items || []

    for (const item of items) {
      item?.default && defaultCount++

      if ('keepAlive' in (item || {}) && typeof item?.keepAlive !== 'boolean') {
        console.warn(
          `Config item has non-boolean keepAlive (${typeof item?.keepAlive}): `
            + summarize(item))
      }

      const file = String(item?.file || '')
      if (!file) {
        console.warn(`Config item missing file: ${summarize(item)}`)
        continue
      }

      const route =
        `/${path}/${file}`
          .replace(/\/+/g, '/')
          .replace(/\.[^/.]+$/, '')
          .replace(/\/+$/g, '')

      const prev = routes.get(route)
      if (prev) {
        console.warn(
          `Duplicate route "${route}" in config:\n`
            + `- ${summarize(prev)}\n`
            + `- ${summarize(item)}`)
      } else {
        routes.set(route, item)
      }
    }
  }

  defaultCount === 0
    && console.warn('No config item is marked { default: true }.')

  defaultCount > 1
    && console.warn(`Multiple default items found (${defaultCount}).`)
}
