import { include, parse } from '../graph/index.js'
import {
  currentPage,
  currentRoute,
  pages
} from './navigation.js'

/** Assemble the configured page files with the authored Root. */
export const assemble = (sources, route) => {
  const page = currentPage(route)
  const root = sources['/src/root.lisp']
  const content = sources[page?.source]

  if (!root) throw new Error('Missing root source: /src/root.lisp')
  if (!content) throw new Error(`Missing page source: ${page?.source}`)

  const library = `(${pages
    .map(({ source }) => `(include ${source})`)
    .join('\n ')})`

  // The first authored identity names the page; page.lisp owns its initial
  // continuation so route configuration does not duplicate graph structure.
  const name = parse(content)[0]?.[0]
  const initial = `((start (${name}-initial ${name}-initial)))`

  return include(root, {
    ...sources,
    './initial.lisp': initial,
    './pages.lisp': library
  })
}

/** Load the authored files and assemble Root before linking once. */
export const program = (route = currentRoute()) => assemble(
  // Vite must see this call directly to replace it with the source imports.
  import.meta.glob('/src/**/*.lisp', {
    eager: true,
    import: 'default',
    query: '?raw'
  }),
  route
)
