import './style.css'
import { view } from './device.js'
import { functions } from './functions.js'
import { include } from './graph/index.js'
import { findDefaultItem, getActiveItem }
  from '../../utils/site-content.js'

const files = import.meta.glob('./*.lisp', {
  eager: true,
  import: 'default',
  query: '?raw'
})

const root = () => {
  const route = window.location.pathname
  const item = getActiveItem(route) ?? findDefaultItem()
  const content = files[`./${item.source}`]

  if (!content) throw new Error(`Missing page source: ${item.source}`)

  // Browser routing is a temporary boundary. The graph receives the selected
  // content and route, but will eventually select its own page identities.
  // Route changes currently relink that content rather than retaining it.
  const program = include(files['./root.lisp'], {
    ...files,
    './content.lisp': content
  })

  return view(program, { ...functions, route })
}

export default root
