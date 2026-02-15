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

const scriptModules =
  import.meta.glob('/src/pages/**/*.js')

export const loadMarkdownText = async path => {
  const loader = markdownModules[path]
  if (loader) return /** @type {Promise<string>} */ (loader())

  // Fallback for environments that don't support `import.meta.glob` (or if a
  // file is missing from the glob for any reason).
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load ${path}`)
  return await res.text()
}

export const loadScriptDefault = async path => {
  const loader = scriptModules[path]
  if (!loader) throw new Error(`Missing script module: ${path}`)

  const module = await loader()
  if (!module || typeof module.default !== 'function') {
    throw new Error(`Expected default export function in: ${path}`)
  }

  return module.default
}

