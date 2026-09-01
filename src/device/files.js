import { currentRoute } from './navigation.js'
import { assembleProgram } from './program.js'

// Vite must see this call directly to replace it with the source imports.
const sources = import.meta.glob('/src/**/*.lisp', {
  eager: true,
  import: 'default',
  query: '?raw'
})

/** Assemble the selected page with the authored Root before linking once. */
export const program = (route = currentRoute()) =>
  assembleProgram(sources, route)
