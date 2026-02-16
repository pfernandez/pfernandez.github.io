// Content loaders (Vite-aware).
//
// We prefer `import.meta.glob()` over ad-hoc fetch/dynamic-import so:
// - Vite can include these files in production builds.
// - Dynamic module loads are reliable across routes.
//
// The keys of these maps are absolute-from-root paths like:
//   `/src/pages/foo/bar.md`
//   `/src/pages/foo/bar.js`

const markdownModules =
  import.meta.glob('/src/pages/**/*.md', { query: '?raw', import: 'default' })

const scriptModules = import.meta.glob('/src/pages/**/*.js')

export const loadMarkdownText = async path => {
  const loader = markdownModules[path]
  if (!loader) throw new Error(`Missing markdown module: ${path}`)
  return /** @type {Promise<string>} */ (loader())
}

export const loadScriptDefault = async path => {
  const loader = scriptModules[path]
  if (!loader) throw new Error(`Missing script module: ${path}`)

  const module = await loader()
  // @ts-ignore
  if (!module || typeof module.default !== 'function') {
    throw new Error(`Expected default export function in: ${path}`)
  }

  // @ts-ignore
  return module.default
}
