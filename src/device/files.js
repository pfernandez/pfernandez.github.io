import { include } from '../graph/index.js'
import { currentPage, currentRoute } from './navigation.js'

const sources = typeof import.meta.glob === 'function'
  ? import.meta.glob('/src/**/*.lisp', {
    eager: true,
    import: 'default',
    query: '?raw'
  })
  : {}

/** Assemble the selected page with the authored Root before linking once. */
export const program = (route = currentRoute()) => {
  const page = currentPage(route)
  const root = sources['/src/root.lisp']
  const content = sources[page?.source]

  if (!root) throw new Error('Missing root source: /src/root.lisp')
  if (!content) throw new Error(`Missing page source: ${page?.source}`)

  return include(root, {
    ...sources,
    './content.lisp': content
  })
}
