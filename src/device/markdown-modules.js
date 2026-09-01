// Keep Vite's source discovery at the browser boundary. Markdown's runtime is
// otherwise importable in Node and accepts an explicit module table in tests.
export const pageModules = import.meta.glob([
  '/src/pages/**/*.js',
  '!/src/pages/config.js',
  '!/src/pages/**/*.test.js'
])
