import { serialize } from '../sexpr.js'
import { dashboard } from './dashboard.js'

export default dashboard(
  { title: 'S-expressions',
    hint: 'The same build/observe pipeline as the tree view. Observation performs one tick.',
    kind: 'lisp',
    scene: pair => serialize(pair) })
