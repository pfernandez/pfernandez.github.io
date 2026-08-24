import './style.css'
import { view } from './device.js'
import { functions } from './functions.js'
import { include } from './graph/index.js'
import dashboard from './dashboard.lisp?raw'
import root from './root.lisp?raw'

export default view(include(dashboard, root), functions)
