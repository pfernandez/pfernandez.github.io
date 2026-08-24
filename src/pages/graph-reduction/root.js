import './style.css'
import { view } from './device.js'
import { functions } from './functions.js'
import { include } from './graph/index.js'

const files = import.meta.glob('./*.lisp', {
  eager: true,
  import: 'default',
  query: '?raw'
})

export default view(include(files['./root.lisp'], files), functions)
