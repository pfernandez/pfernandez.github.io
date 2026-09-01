import { include } from '../graph/index.js'
import { currentPage } from './navigation.js'

/** Select one page and assemble it with the authored Root. */
export const assembleProgram = (sources, route) => {
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
