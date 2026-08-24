import './style.css'
import { view } from './device.js'
import { functions } from './functions.js'
import source from './observe.lisp?raw'

export default view(source, functions)
