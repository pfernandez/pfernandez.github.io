// Keep Vite's source discovery at the browser boundary. Markdown's runtime is
// otherwise importable in Node and accepts an explicit module table in tests.
export const pageModules = import.meta.glob([
  '/src/pages/**/*.js',
  '!/src/pages/**/*.test.js',
  // The former JavaScript dashboard is retained only as a migration reference.
  '!/src/pages/graph-reduction/dashboard.js'
])
